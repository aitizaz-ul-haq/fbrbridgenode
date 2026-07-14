# FBR Sales Tax Sandbox Bridge

A small, secure Node.js/TypeScript bridge API that receives invoice submissions
from a main Next.js application (server-side only), attaches the FBR/PRAL
sandbox bearer token, forwards the invoice to the FBR sandbox from a whitelisted
DigitalOcean droplet, and returns the complete FBR response for storage in
MongoDB by the main application.

The browser must **never** call this bridge directly.

## Features

- `GET /health` — liveness/health probe.
- `POST /api/v1/fbr/invoices/validate` — validate an invoice through FBR.
- `POST /api/v1/fbr/invoices/submit` — submit an invoice to FBR.
- Internal bearer-token auth (`BRIDGE_API_KEY`), strict CORS allowlist, Helmet,
  rate limiting, 1mb body limit, request timeouts.
- Full, unmodified FBR response preserved in a consistent envelope.
- Structured logging (Pino) with secret redaction and identifier masking.
- **Mock mode** so you can run everything before the FBR sandbox token exists.
- Dev-only in-memory idempotency replay protection.

## Requirements

- Node.js 20 LTS or newer
- npm

## Setup

```bash
npm install
cp .env.example .env
# edit .env — keep FBR_MOCK_MODE=true until you have a real sandbox token
```

### Environment variables

| Variable             | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `NODE_ENV`           | `development` / `production`                                   |
| `PORT`               | Bridge port (default `3001`)                                   |
| `HOST`               | Bind address — use `127.0.0.1` behind Nginx                    |
| `FBR_BASE_URL`       | `https://gw.fbr.gov.pk/di_data/v1/di`                          |
| `FBR_SANDBOX_TOKEN`  | FBR bearer token (not required while `FBR_MOCK_MODE=true`)     |
| `BRIDGE_API_KEY`     | Long random internal key shared with the Next.js backend       |
| `ALLOWED_ORIGINS`    | Comma-separated origin allowlist (required in production)       |
| `REQUEST_TIMEOUT_MS` | Outbound timeout to FBR                                        |
| `LOG_LEVEL`          | Pino log level                                                 |
| `FBR_MOCK_MODE`      | `true` returns fake responses; **must be false in production** |

Production secrets live **only** on the droplet. Never commit `.env`.

## Run locally

```bash
npm run dev      # start with hot reload (tsx)
npm run build    # compile TypeScript to dist/
npm start        # run compiled build
npm test         # run the test suite (all FBR calls mocked)
npm run lint
```

### Quick manual check (mock mode)

```bash
curl http://127.0.0.1:3001/health

curl -X POST http://127.0.0.1:3001/api/v1/fbr/invoices/validate \
  -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -H "X-Request-ID: 11111111-1111-1111-1111-111111111111" \
  -H "X-Idempotency-Key: demo-key-1" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionId": "local-record-1",
    "invoice": {
      "invoiceType": "Sale Invoice",
      "invoiceDate": "2026-07-14",
      "sellerNTNCNIC": "0000000000000",
      "sellerBusinessName": "Your Business Name",
      "sellerProvince": "Sindh",
      "sellerAddress": "Seller Address",
      "buyerNTNCNIC": "1111111111111",
      "buyerBusinessName": "Buyer Business Name",
      "buyerProvince": "Punjab",
      "buyerAddress": "Buyer Address",
      "buyerRegistrationType": "Registered",
      "invoiceRefNo": "",
      "scenarioId": "SN000",
      "items": [{
        "hsCode": "0000.0000",
        "productDescription": "Example product",
        "rate": "0%",
        "uoM": "Numbers, pieces, units",
        "quantity": 1,
        "totalValues": 1000,
        "valueSalesExcludingST": 1000,
        "fixedNotifiedValueOrRetailPrice": 0,
        "salesTaxApplicable": 0,
        "salesTaxWithheldAtSource": 0,
        "extraTax": "",
        "furtherTax": 0,
        "sroScheduleNo": "",
        "fedPayable": 0,
        "discount": 0,
        "saleType": "",
        "sroItemSerialNo": ""
      }]
    }
  }'
```

## Request/response contract

Callers send the optional wrapper; only the `invoice` object is forwarded to FBR:

```json
{ "submissionId": "local-mongodb-record-id", "invoice": { "...": "FBR payload" } }
```

Required headers on FBR endpoints:

```http
Authorization: Bearer <BRIDGE_API_KEY>
X-Request-ID: <uuid>
X-Idempotency-Key: <stable-unique-key>
Content-Type: application/json
```

The bridge always returns a consistent envelope containing `success`,
`requestId`, `submissionId`, `environment`, `action`, `httpStatus`,
`fbrResponse` (the complete unmodified FBR body), and `receivedAt`. Rejections
add an `error` object with a code from Section 17 of the spec.

> The exact FBR receipt/reference property names are **not** assumed. The main
> application must extract them only after observing a real sandbox response.

## Enabling real FBR calls

1. Obtain the FBR sandbox token.
2. Set `FBR_SANDBOX_TOKEN` on the droplet.
3. Set `FBR_MOCK_MODE=false`.
4. Restart the service (`pm2 reload fbr-bridge`).

## Deployment (DigitalOcean droplet)

Whitelisted public IPv4: **152.42.177.122** (DigitalOcean, Singapore).

Confirm the droplet's outbound IPv4 before FBR whitelisting:

```bash
curl -4 https://icanhazip.com   # must return 152.42.177.122
```

### 1. Install prerequisites (Ubuntu)

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

### 2. Deploy as a non-root user

```bash
sudo adduser --disabled-password deploy
sudo usermod -aG sudo deploy
sudo su - deploy

git clone <your-repo-url> fbr-bridge && cd fbr-bridge
npm ci
npm run build

cp .env.example .env
# edit .env with production values; set FBR_MOCK_MODE=false and a real token
```

### 3. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup    # run the printed command to enable boot persistence
```

The service binds to `127.0.0.1:3001` and is **not** exposed publicly.

### 4. Nginx reverse proxy (HTTPS)

Create `/etc/nginx/sites-available/fbr-bridge`:

```nginx
server {
    server_name fbr-gateway.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fbr-bridge /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS via Let's Encrypt once DNS points at the droplet
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d fbr-gateway.yourdomain.com
```

### 5. Firewall (expose only 22/80/443)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Port `3001` must never be exposed publicly.

## Security notes

- FBR token and bridge API key live only in server environment variables.
- Authorization headers and tokens are never logged (Pino redaction).
- Taxpayer identifiers are masked in logs.
- No wildcard CORS; strict origin allowlist.
- No automatic retries on submission (avoids duplicate tax invoices).
- Production duplicate protection lives in the main application's MongoDB;
  the in-memory idempotency cache here is for development only.

## Project structure

```text
src/
├── app.ts                 # Express app wiring
├── server.ts              # HTTP server + graceful shutdown
├── config/env.ts          # Validated environment configuration
├── controllers/           # fbr.controller.ts
├── middleware/            # auth, error, request-id, rate-limit
├── routes/               # health.routes.ts, fbr.routes.ts
├── schemas/              # invoice.schema.ts (Zod)
├── services/             # fbr.service.ts (Axios client + mock)
├── types/                # invoice.ts
└── utils/                # logger, response envelope, idempotency
tests/                     # vitest suites (all FBR calls mocked)
```
# fbrbridgenode
