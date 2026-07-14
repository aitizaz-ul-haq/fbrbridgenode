# FBR Sales Tax Sandbox Bridge API — GitHub Copilot Build Specification

## 1. Purpose

Build a small, secure Node.js bridge API that runs on a DigitalOcean Droplet with a whitelisted public IPv4 address.

The bridge must:

1. Receive an invoice submission request from the main Next.js application backend.
2. Validate the invoice payload.
3. Add the FBR/PRAL sandbox bearer token from server-side environment variables.
4. Submit the invoice to the FBR sandbox API from the DigitalOcean Droplet.
5. Return the complete FBR response to the main application.
6. Allow the main application to store the FBR receipt/response in MongoDB.
7. Support invoice validation before final submission.
8. Prevent duplicate submissions through idempotency controls.
9. Never expose the FBR token to the browser.

## 2. Hosting and IP Whitelisting

Hosting provider:

- Hosting Server Company Name: DigitalOcean, LLC
- Hosting Server Country: Singapore
- Whitelisted Public IPv4: 152.42.177.122

Important:

- The bridge API must be deployed on the Droplet using the public IP above.
- Confirm the Droplet's outbound IPv4 before FBR whitelisting by running:

```bash
curl -4 https://icanhazip.com
```

- The returned address must match `152.42.177.122`.
- Do not use the private DigitalOcean address beginning with `10.`.
- Do not destroy or recreate the Droplet after FBR whitelisting unless the IP arrangement is preserved.

## 3. System Architecture

```text
User Browser
    |
    v
Next.js Application
    |
    | Server-side request only
    v
Next.js API Route / Server Action
    |
    | Signed internal request
    v
Node.js FBR Bridge on DigitalOcean
    |
    | Bearer token added here
    v
FBR / PRAL Sandbox API
    |
    v
FBR response / receipt
    |
    v
Node.js FBR Bridge
    |
    v
Next.js backend
    |
    v
MongoDB invoice submission record
```

The browser must never call the FBR bridge directly.

## 4. Recommended Technology Stack

Use:

- Node.js current LTS
- TypeScript
- Express
- Axios
- Zod for validation
- Helmet
- CORS with a strict allowlist
- express-rate-limit
- Pino for structured logging
- PM2 for process management
- Nginx as the HTTPS reverse proxy
- dotenv for local development only
- Vitest or Jest for tests
- ESLint and Prettier

The bridge should not require MongoDB for the first version. The main Next.js application will store the final submission and FBR response in MongoDB.

## 5. FBR Sandbox Endpoints

### Submit invoice

```text
POST https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb
```

### Validate invoice

```text
POST https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb
```

Authentication:

```http
Authorization: Bearer <FBR_SANDBOX_TOKEN>
Content-Type: application/json
```

The sandbox token is not currently available. Keep it in an environment variable and never hardcode it.

## 6. Environment Variables

Create `.env.example`:

```env
NODE_ENV=development
PORT=3001

FBR_BASE_URL=https://gw.fbr.gov.pk/di_data/v1/di
FBR_SANDBOX_TOKEN=replace_with_real_sandbox_token

BRIDGE_API_KEY=replace_with_long_random_internal_key
ALLOWED_ORIGINS=https://your-nextjs-domain.example

REQUEST_TIMEOUT_MS=30000
LOG_LEVEL=info
```

Production secrets must be stored only on the Droplet. Do not commit `.env` files.

## 7. Invoice Payload Format

Use this payload shape:

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "yyyy-MM-dd",
  "sellerNTNCNIC": "0000000000000",
  "sellerBusinessName": "Your Business Name",
  "sellerProvince": "Seller Province",
  "sellerAddress": "Seller Address",
  "buyerNTNCNIC": "0000000000000",
  "buyerBusinessName": "Buyer Business Name",
  "buyerProvince": "Buyer Province",
  "buyerAddress": "Buyer Address",
  "buyerRegistrationType": "Registered",
  "invoiceRefNo": "",
  "scenarioId": "SN000",
  "items": [
    {
      "hsCode": "0000.0000",
      "productDescription": "",
      "rate": "0%",
      "uoM": "",
      "quantity": 0,
      "totalValues": 0,
      "valueSalesExcludingST": 0,
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
    }
  ]
}
```

## 8. TypeScript Types

Create `src/types/invoice.ts`.

```ts
export interface FbrInvoiceItem {
  hsCode: string;
  productDescription: string;
  rate: string;
  uoM: string;
  quantity: number;
  totalValues: number;
  valueSalesExcludingST: number;
  fixedNotifiedValueOrRetailPrice: number;
  salesTaxApplicable: number;
  salesTaxWithheldAtSource: number;
  extraTax: string;
  furtherTax: number;
  sroScheduleNo: string;
  fedPayable: number;
  discount: number;
  saleType: string;
  sroItemSerialNo: string;
}

export interface FbrInvoice {
  invoiceType: string;
  invoiceDate: string;
  sellerNTNCNIC: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
  buyerNTNCNIC: string;
  buyerBusinessName: string;
  buyerProvince: string;
  buyerAddress: string;
  buyerRegistrationType: string;
  invoiceRefNo: string;
  scenarioId: string;
  items: FbrInvoiceItem[];
}
```

Create equivalent Zod schemas. At minimum validate:

- `invoiceDate` uses `YYYY-MM-DD`.
- `items` contains at least one item.
- numeric fields are finite and non-negative where appropriate.
- required text fields are not empty.
- `sellerNTNCNIC` and `buyerNTNCNIC` are strings and are not silently converted to numbers.
- `quantity` is greater than zero for real test submissions.
- `invoiceRefNo` and `scenarioId` remain strings.
- unknown fields are rejected or stripped deliberately.

Do not invent unsupported FBR business rules. Keep business-rule validation configurable until official rules are confirmed.

## 9. Bridge API Endpoints

### Health check

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "fbr-bridge",
  "environment": "sandbox"
}
```

### Validate an invoice through FBR

```http
POST /api/v1/fbr/invoices/validate
```

### Submit an invoice to FBR

```http
POST /api/v1/fbr/invoices/submit
```

Required internal headers:

```http
Authorization: Bearer <BRIDGE_API_KEY>
X-Request-ID: <uuid>
X-Idempotency-Key: <stable-unique-key>
Content-Type: application/json
```

The bridge should accept an optional wrapper:

```json
{
  "submissionId": "local-mongodb-record-id-or-uuid",
  "invoice": {
    "...": "FBR invoice payload"
  }
}
```

The bridge must forward only the `invoice` object to FBR.

## 10. Standard Bridge Response

The bridge should return a consistent envelope regardless of whether FBR accepts or rejects the invoice.

```json
{
  "success": true,
  "requestId": "uuid",
  "submissionId": "caller-provided-id",
  "environment": "sandbox",
  "action": "submit",
  "httpStatus": 200,
  "fbrResponse": {},
  "receivedAt": "2026-07-14T10:00:00.000Z"
}
```

On an FBR rejection:

```json
{
  "success": false,
  "requestId": "uuid",
  "submissionId": "caller-provided-id",
  "environment": "sandbox",
  "action": "submit",
  "httpStatus": 400,
  "error": {
    "code": "FBR_REJECTED",
    "message": "FBR rejected the invoice."
  },
  "fbrResponse": {},
  "receivedAt": "2026-07-14T10:00:00.000Z"
}
```

Preserve the full FBR response body because its exact receipt/reference structure must be stored by the main application.

Do not assume response property names until a real sandbox response has been observed.

## 11. Main Next.js Application Storage Model

The main application should create a MongoDB submission record before calling the bridge.

Suggested Mongoose schema:

```ts
{
  _id: ObjectId,
  internalSubmissionId: String,
  idempotencyKey: String,

  invoicePayload: Object,

  status: {
    type: String,
    enum: [
      "draft",
      "validation_pending",
      "validated",
      "validation_failed",
      "submission_pending",
      "submitted",
      "rejected",
      "transport_failed"
    ]
  },

  validationResponse: Object,
  submissionResponse: Object,

  fbrReferenceNumber: String,
  fbrInvoiceNumber: String,

  bridgeRequestId: String,
  bridgeHttpStatus: Number,

  attemptCount: Number,
  lastAttemptAt: Date,
  submittedAt: Date,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

`fbrReferenceNumber` and `fbrInvoiceNumber` should be populated only after observing the real FBR response. Store the unmodified response in `submissionResponse`.

## 12. Main Application Submission Flow

Implement this sequence in the Next.js backend:

1. Receive invoice data from the authenticated user.
2. Validate user permission and tenant/company ownership.
3. Validate the payload locally.
4. Create a MongoDB record with status `validation_pending`.
5. Generate:
   - `submissionId`
   - `requestId`
   - `idempotencyKey`
6. Call the bridge validation endpoint.
7. Store the complete validation response.
8. If validation succeeds, update status to `validated`.
9. When the user confirms submission, update status to `submission_pending`.
10. Call the bridge submission endpoint.
11. Store the complete bridge and FBR response.
12. Set the final status:
    - `submitted`
    - `rejected`
    - `transport_failed`
13. Return a safe result to the UI.

The main application must call the bridge only from a server-side API route, route handler, server action, or backend service.

## 13. Idempotency and Duplicate Protection

Tax invoices must not be submitted twice accidentally.

Implement:

- a unique `X-Idempotency-Key`;
- a unique database index on `idempotencyKey`;
- a stable key generated from the internal submission record;
- no automatic retry after an unknown timeout unless submission status can be safely determined;
- separate handling for:
  - FBR explicitly rejected the request;
  - network connection failed before sending;
  - timeout after the request may have reached FBR;
  - malformed bridge response.

For the initial version, keep an in-memory idempotency cache in the bridge only for development. Production duplicate protection should primarily live in MongoDB in the main application, or in a persistent Redis/database store if the bridge becomes responsible for retries.

## 14. Security Requirements

Implement all of the following:

- FBR token stored only in a server environment variable.
- Bridge API key stored only in the Next.js backend and bridge environment.
- Reject requests without the correct internal bearer token.
- HTTPS only in production.
- Nginx reverse proxy.
- Helmet security headers.
- Strict body-size limit, for example `1mb`.
- Request timeouts.
- Rate limiting.
- No wildcard CORS.
- Never log:
  - FBR token
  - bridge API key
  - full authorization headers
- Mask sensitive taxpayer identifiers in production logs.
- Do not expose port `3001` publicly.
- Expose only ports `22`, `80`, and `443`.
- Run Node.js as a non-root user.
- Use PM2 to keep the service alive.
- Return generic errors to callers while logging technical details securely.
- Validate `X-Request-ID` and `X-Idempotency-Key`.

## 15. Suggested Project Structure

```text
fbr-bridge/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── env.ts
│   ├── controllers/
│   │   └── fbr.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── request-id.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── routes/
│   │   ├── health.routes.ts
│   │   └── fbr.routes.ts
│   ├── schemas/
│   │   └── invoice.schema.ts
│   ├── services/
│   │   └── fbr.service.ts
│   ├── types/
│   │   └── invoice.ts
│   └── utils/
│       ├── logger.ts
│       └── response.ts
├── tests/
│   ├── invoice.schema.test.ts
│   └── fbr.routes.test.ts
├── .env.example
├── .gitignore
├── ecosystem.config.cjs
├── package.json
├── tsconfig.json
└── README.md
```

## 16. FBR Service Requirements

Create a reusable Axios client with:

- base URL from `FBR_BASE_URL`;
- bearer token from `FBR_SANDBOX_TOKEN`;
- JSON content type;
- configurable timeout;
- no automatic retries for submission requests;
- response interception for controlled errors.

Pseudo-code:

```ts
export async function validateInvoice(invoice: FbrInvoice) {
  return fbrClient.post("/validateinvoicedata_sb", invoice);
}

export async function submitInvoice(invoice: FbrInvoice) {
  return fbrClient.post("/postinvoicedata_sb", invoice);
}
```

Never log the Axios configuration object because it may include the authorization header.

## 17. Error Categories

Create explicit internal error codes:

```text
INVALID_REQUEST
UNAUTHORIZED_BRIDGE_REQUEST
FBR_TOKEN_MISSING
FBR_VALIDATION_REJECTED
FBR_SUBMISSION_REJECTED
FBR_TIMEOUT
FBR_NETWORK_ERROR
FBR_UNEXPECTED_RESPONSE
INTERNAL_ERROR
```

Preserve:

- HTTP status returned by FBR;
- complete FBR response body;
- request ID;
- submission ID;
- timestamp.

## 18. Local Testing Without a Real FBR Token

Since the sandbox token is currently unavailable, support a mock mode:

```env
FBR_MOCK_MODE=true
```

When enabled:

- do not call FBR;
- return a clearly marked fake response;
- never enable mock mode in production;
- add `mock: true` to the response envelope.

Example:

```json
{
  "success": true,
  "mock": true,
  "requestId": "uuid",
  "submissionId": "uuid",
  "httpStatus": 200,
  "fbrResponse": {
    "message": "Mock validation successful",
    "reference": "MOCK-12345"
  }
}
```

## 19. Test Requirements

Write tests for:

- valid invoice accepted locally;
- missing required field rejected;
- invalid date format rejected;
- empty items array rejected;
- missing bridge API key rejected;
- FBR validation success forwarded;
- FBR validation rejection preserved;
- FBR submission success preserved;
- FBR timeout mapped correctly;
- FBR network error mapped correctly;
- duplicate idempotency key rejected or safely replayed;
- secrets absent from logs.

Mock all outbound FBR calls in automated tests.

## 20. Deployment Requirements

Deploy the bridge to the DigitalOcean Droplet.

Required components:

1. Node.js LTS
2. non-root deployment user
3. Git
4. PM2
5. Nginx
6. UFW or DigitalOcean Cloud Firewall
7. TLS certificate through Let's Encrypt after a domain/subdomain points to the Droplet

Recommended domain:

```text
fbr-gateway.yourdomain.com
```

Nginx should proxy:

```text
https://fbr-gateway.yourdomain.com
```

to:

```text
http://127.0.0.1:3001
```

Do not bind the Node.js service to a publicly exposed interface unless required. Prefer `127.0.0.1`.

## 21. GitHub Copilot Implementation Prompt

Use the following prompt with GitHub Copilot:

> Build this project exactly according to the `FBR_BRIDGE_SPEC.md` file in the repository. Use Node.js, TypeScript, Express, Axios, Zod, Helmet, express-rate-limit, Pino, PM2, and Nginx deployment documentation. Create a secure bridge API with health, FBR validation, and FBR submission endpoints. Keep the FBR sandbox token and bridge API key in environment variables. Preserve the complete FBR response in a consistent response envelope. Do not assume undocumented FBR response fields. Add mock mode because the FBR sandbox token is not available yet. Add comprehensive tests with mocked outbound FBR calls. Do not expose secrets to the browser or logs. Generate complete source files rather than placeholders, and explain every command required to run locally and deploy to Ubuntu on DigitalOcean.

## 22. Definition of Done

The project is complete when:

- `npm run dev` starts the bridge locally.
- `npm run build` succeeds.
- `npm test` succeeds.
- `GET /health` works.
- unauthorized calls are rejected.
- invoice payload validation works.
- mock validation and submission work.
- real FBR calls can be enabled by setting a token and disabling mock mode.
- the complete FBR response is returned to the Next.js backend.
- deployment instructions for PM2, Nginx, HTTPS, and firewall are documented.
- the service runs on the DigitalOcean Droplet.
- outbound traffic is confirmed to use `152.42.177.122`.

## 23. Important Deployment Clarification for the Main Application

For testing, the entire main application does not have to be publicly deployed immediately.

Possible testing arrangement:

```text
Local browser
    |
Local Next.js application
    |
Internet request from local Next.js backend
    |
DigitalOcean FBR bridge
    |
FBR sandbox
```

However:

- The Next.js backend must be running.
- MongoDB must be reachable by the Next.js backend.
- If using MongoDB Atlas, a development cluster can be used.
- If using local MongoDB, the database remains available only while the local machine and MongoDB service are running.
- The browser UI alone is not enough because the submission workflow requires backend code and database persistence.
- Do not deploy a separate MongoDB server on the Droplet merely for this test unless there is a specific operational reason.
- MongoDB Atlas is the simpler testing and production option.
- The bridge does not need direct MongoDB access in the first version.

Recommended test deployment:

1. Keep the Next.js application local initially.
2. Use MongoDB Atlas development/test database.
3. Deploy only the bridge to DigitalOcean because FBR requires its public IP.
4. Test the complete workflow from local Next.js backend to bridge to FBR sandbox.
5. Deploy the Next.js application later to Vercel or another host when ready.

## 24. Original .NET Reference Supplied by FBR

The equivalent FBR sample was:

```csharp
HttpClient client = new HttpClient();

client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", "your token");

StringContent content = new StringContent(
    JsonConvert.SerializeObject(objinvoice),
    Encoding.UTF8,
    "application/json"
);

HttpResponseMessage response = client
    .PostAsync(
        "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb",
        content
    )
    .Result;

if (response.IsSuccessStatusCode)
{
    Console.WriteLine("Response from API:");
    Console.WriteLine("-------------------------------");
    Console.WriteLine(response.Content.ReadAsStringAsync().Result);
}
```

The Node.js bridge must provide the same core behavior asynchronously, securely, and with production-grade validation, logging, error handling, and response preservation.


# 25. Exact Next.js Main Application API Integration

The main application uses Next.js 14 App Router and MongoDB. GitHub Copilot must also generate the integration layer in the main application so the UI can validate an invoice, submit it, receive the FBR receipt, store it, and display it to the user.

The bridge repository and the Next.js repository may remain separate projects.

## 25.1 Main Application Environment Variables

Add these variables to the Next.js application's `.env.local.example`:

```env
MONGODB_URI=mongodb+srv://replace_with_connection_string
FBR_BRIDGE_BASE_URL=https://fbr-gateway.yourdomain.com
FBR_BRIDGE_API_KEY=replace_with_same_key_used_by_bridge
FBR_BRIDGE_TIMEOUT_MS=35000
```

Rules:

- `FBR_BRIDGE_API_KEY` must never use a `NEXT_PUBLIC_` prefix.
- The browser must never receive the bridge API key.
- Only Next.js server-side code may call the bridge.
- The browser calls only the Next.js application's own `/api/...` routes.

## 25.2 Required Next.js Route Handlers

Generate the following Next.js 14 App Router routes.

### Create or save invoice draft

```text
POST /api/fbr/invoices
```

Responsibilities:

1. Authenticate the logged-in user.
2. Validate tenant/company ownership.
3. Validate the invoice payload locally.
4. Create a MongoDB invoice submission record.
5. Return the saved record ID and current status.

Example request:

```json
{
  "invoice": {
    "invoiceType": "Sale Invoice",
    "invoiceDate": "2026-07-14",
    "sellerNTNCNIC": "0000000000000",
    "sellerBusinessName": "Your Business Name",
    "sellerProvince": "Seller Province",
    "sellerAddress": "Seller Address",
    "buyerNTNCNIC": "0000000000000",
    "buyerBusinessName": "Buyer Business Name",
    "buyerProvince": "Buyer Province",
    "buyerAddress": "Buyer Address",
    "buyerRegistrationType": "Registered",
    "invoiceRefNo": "",
    "scenarioId": "SN000",
    "items": [
      {
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
      }
    ]
  }
}
```

Example response:

```json
{
  "success": true,
  "submission": {
    "id": "mongodb-record-id",
    "status": "draft",
    "createdAt": "2026-07-14T10:00:00.000Z"
  }
}
```

### Validate saved invoice through the bridge and FBR

```text
POST /api/fbr/invoices/[submissionId]/validate
```

Responsibilities:

1. Authenticate the user.
2. Load the MongoDB record.
3. Verify tenant/company ownership.
4. Set status to `validation_pending`.
5. Generate a UUID request ID.
6. Generate or reuse the stable idempotency key.
7. Call:

```text
POST {FBR_BRIDGE_BASE_URL}/api/v1/fbr/invoices/validate
```

with server-side headers:

```http
Authorization: Bearer <FBR_BRIDGE_API_KEY>
X-Request-ID: <uuid>
X-Idempotency-Key: <stable-key>
Content-Type: application/json
```

and body:

```json
{
  "submissionId": "mongodb-record-id",
  "invoice": {}
}
```

8. Store the complete bridge response in `validationResponse`.
9. Update status to `validated`, `validation_failed`, or `transport_failed`.
10. Return a safe but sufficiently complete response to the UI.

Example response to the browser:

```json
{
  "success": true,
  "submissionId": "mongodb-record-id",
  "status": "validated",
  "message": "Invoice validation completed successfully.",
  "validation": {
    "bridgeRequestId": "uuid",
    "httpStatus": 200,
    "fbrResponse": {}
  }
}
```

### Submit validated invoice through the bridge and FBR

```text
POST /api/fbr/invoices/[submissionId]/submit
```

Responsibilities:

1. Authenticate the user.
2. Load and authorize access to the saved invoice.
3. Require status `validated` unless an administrator override is explicitly supported.
4. Prevent submission if status is already `submitted`.
5. Set status to `submission_pending`.
6. Call:

```text
POST {FBR_BRIDGE_BASE_URL}/api/v1/fbr/invoices/submit
```

with the same internal authentication and idempotency headers.
7. Store the complete unmodified bridge response and FBR response.
8. Extract FBR receipt/reference values only when confirmed from the real response.
9. Update status to:
   - `submitted`
   - `rejected`
   - `transport_failed`
10. Return the receipt/result to the UI.

Example successful response:

```json
{
  "success": true,
  "submissionId": "mongodb-record-id",
  "status": "submitted",
  "message": "Invoice submitted successfully.",
  "receipt": {
    "bridgeRequestId": "uuid",
    "httpStatus": 200,
    "fbrResponse": {}
  }
}
```

Example rejected response:

```json
{
  "success": false,
  "submissionId": "mongodb-record-id",
  "status": "rejected",
  "message": "FBR rejected the invoice.",
  "receipt": {
    "bridgeRequestId": "uuid",
    "httpStatus": 400,
    "fbrResponse": {}
  }
}
```

### Get one invoice submission and stored receipt

```text
GET /api/fbr/invoices/[submissionId]
```

Responsibilities:

- Authenticate the user.
- Verify tenant/company ownership.
- Return invoice data, current status, validation result, submission result, timestamps, and receipt information.
- Mask fields that the current role must not see.

Example response:

```json
{
  "success": true,
  "submission": {
    "id": "mongodb-record-id",
    "status": "submitted",
    "invoicePayload": {},
    "validationResponse": {},
    "submissionResponse": {},
    "fbrReferenceNumber": null,
    "fbrInvoiceNumber": null,
    "createdAt": "2026-07-14T10:00:00.000Z",
    "submittedAt": "2026-07-14T10:05:00.000Z"
  }
}
```

### List invoice submissions

```text
GET /api/fbr/invoices?page=1&limit=20&status=submitted
```

Responsibilities:

- Return only records belonging to the authenticated user's permitted company/tenant.
- Support pagination, status filtering, date filtering, and invoice reference search.
- Do not return secret environment values or internal authorization headers.

## 25.3 Suggested Next.js File Structure

```text
app/
└── api/
    └── fbr/
        └── invoices/
            ├── route.ts
            └── [submissionId]/
                ├── route.ts
                ├── validate/
                │   └── route.ts
                └── submit/
                    └── route.ts

lib/
├── db/
│   └── mongodb.ts
├── models/
│   └── FbrInvoiceSubmission.ts
├── fbr/
│   ├── bridge-client.ts
│   ├── invoice-schema.ts
│   ├── invoice-types.ts
│   └── response-mapper.ts
└── auth/
    └── require-user.ts
```

## 25.4 Bridge Client in the Main Application

Create `lib/fbr/bridge-client.ts`.

Requirements:

- Use server-only code.
- Read `FBR_BRIDGE_BASE_URL` and `FBR_BRIDGE_API_KEY`.
- Never export secrets to client components.
- Add authorization, request ID, and idempotency headers.
- Apply a timeout.
- Parse JSON safely.
- Preserve non-2xx FBR/bridge responses instead of discarding their bodies.
- Do not automatically retry invoice submission.

Suggested functions:

```ts
export async function validateInvoiceThroughBridge(args: {
  submissionId: string;
  requestId: string;
  idempotencyKey: string;
  invoice: FbrInvoice;
}): Promise<BridgeResponse>;

export async function submitInvoiceThroughBridge(args: {
  submissionId: string;
  requestId: string;
  idempotencyKey: string;
  invoice: FbrInvoice;
}): Promise<BridgeResponse>;
```

## 25.5 Main UI Requirements

GitHub Copilot must create or update the invoice UI so the user can see every stage.

The invoice detail page should show:

- invoice reference;
- seller and buyer summary;
- invoice items;
- current status;
- local validation errors;
- FBR validation response;
- FBR submission response;
- FBR receipt/reference once available;
- request date and time;
- submission date and time;
- retry/help message for transport failures.

Required UI actions:

```text
Save Draft
Validate with FBR
Submit to FBR
View Receipt
View Full Response
```

Button rules:

- `Validate with FBR` is enabled for valid drafts.
- `Submit to FBR` is enabled only after successful validation.
- Disable submission while the request is pending.
- Disable further submission after status becomes `submitted`.
- Do not silently retry a timed-out submission.
- Require a confirmation dialog before final submission.

## 25.6 UI Receipt Panel

After submission, display a receipt panel.

Example:

```text
Submission Status: Submitted
Submission ID: internal MongoDB ID
FBR Reference: value from confirmed FBR response
FBR Invoice Number: value from confirmed FBR response
Submitted At: timestamp
HTTP Status: 200
```

Until the real FBR response is known, also include an expandable JSON viewer:

```text
View complete FBR response
```

The JSON viewer must display the stored `submissionResponse.fbrResponse` from MongoDB. It must not make a new call directly to FBR.

## 25.7 Frontend Request Flow

Client components should call only the main application's APIs:

```ts
await fetch(`/api/fbr/invoices/${submissionId}/validate`, {
  method: "POST"
});

await fetch(`/api/fbr/invoices/${submissionId}/submit`, {
  method: "POST"
});

await fetch(`/api/fbr/invoices/${submissionId}`);
```

Never write frontend code like:

```ts
fetch("https://fbr-gateway.yourdomain.com/api/v1/fbr/invoices/submit")
```

because that would expose the bridge to the browser and bypass the main application's authorization and MongoDB workflow.

## 25.8 MongoDB Persistence Rules

For every validation and submission attempt, store:

- internal submission ID;
- authenticated user ID;
- tenant/company ID;
- invoice payload;
- action performed;
- request ID;
- idempotency key;
- bridge HTTP status;
- complete bridge response;
- complete FBR response;
- success/failure status;
- timestamps;
- attempt count.

Never overwrite the only copy of an earlier failed attempt. Either:

- keep an `attempts` array, or
- create a separate `FbrSubmissionAttempt` collection.

Recommended attempt shape:

```ts
{
  action: "validate" | "submit",
  requestId: string,
  idempotencyKey: string,
  startedAt: Date,
  completedAt: Date,
  bridgeHttpStatus: number,
  success: boolean,
  response: object,
  errorCode: string,
  errorMessage: string
}
```

## 25.9 Updated Copilot Instruction

Use this expanded instruction:

> Build the Node.js FBR bridge according to this document and also generate the Next.js 14 App Router integration described in Section 25. The main application must have authenticated API routes for saving, validating, submitting, retrieving, and listing invoice submissions. It must call the bridge only from server-side code, persist the complete validation/submission/FBR response in MongoDB, and expose the stored receipt to the UI. Generate the Mongoose model, route handlers, server-only bridge client, Zod schemas, status transitions, idempotency protections, and an invoice detail UI with validation and submission buttons plus a receipt/full-response panel. Do not expose the bridge API key or FBR token to the browser.
