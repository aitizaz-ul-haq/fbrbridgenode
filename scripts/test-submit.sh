#!/usr/bin/env bash
#
# Smoke test for the FBR bridge in mock mode (no FBR token required).
# Usage:
#   BRIDGE_API_KEY=your_key ./scripts/test-submit.sh [BASE_URL]
#
# BASE_URL defaults to http://127.0.0.1:3001
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3001}"
API_KEY="${BRIDGE_API_KEY:-}"

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: set BRIDGE_API_KEY to the same value used in the bridge .env" >&2
  exit 1
fi

REQUEST_ID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"
IDEMPOTENCY_KEY="test-$(date +%s)"

echo "== 1. Health check =="
curl -fsS "$BASE_URL/health" && echo

INVOICE='{
  "submissionId": "local-test-1",
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

echo "== 2. Validate invoice =="
curl -fsS -X POST "$BASE_URL/api/v1/fbr/invoices/validate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Request-ID: $REQUEST_ID" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY-validate" \
  -H "Content-Type: application/json" \
  -d "$INVOICE" && echo

echo "== 3. Submit invoice =="
curl -fsS -X POST "$BASE_URL/api/v1/fbr/invoices/submit" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Request-ID: $REQUEST_ID" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY-submit" \
  -H "Content-Type: application/json" \
  -d "$INVOICE" && echo

echo
echo "Done. A response with \"mock\": true confirms mock mode is working."
