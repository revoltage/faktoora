# Headless Upload API

This app supports headless uploads for invoices and statements using API keys.

## Security prerequisites

Set `API_KEY_PEPPER` in your Convex environment before creating or using API keys.

- Why: API keys are never stored in plaintext. The backend stores only an HMAC hash derived using `API_KEY_PEPPER`.
- Requirement: use a long, random value (at least 32 bytes).

Example pepper generation:

```bash
openssl rand -hex 32
```

Set it in Convex:

```bash
npx convex env set API_KEY_PEPPER "<your-random-pepper>"
```

Notes:

- Rotating `API_KEY_PEPPER` invalidates all existing API keys.
- API keys can only be created by non-guest (email) accounts.

## API key management

Create/revoke keys in the app settings modal under "Headless API Keys".

- Key format: `sk_faktoora_...`
- Keys are shown once at creation time.
- Store them securely in your secret manager.

## Base URL

Use your Convex site URL as the base:

```text
https://<your-deployment>.convex.site
```

## Endpoints

### 1) Create upload URL

`POST /api/v1/upload-url`

Header:

- `Authorization: Bearer sk_faktoora_...`

Body:

```json
{
  "kind": "invoice"
}
```

`kind` can be `invoice` or `statement`.

Response:

```json
{
  "uploadUrl": "https://..."
}
```

### 2) Upload file bytes

Upload directly to the returned `uploadUrl` with `POST` and raw file body.

Example:

```bash
curl -sS -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary "@invoice.pdf"
```

Response includes `storageId`:

```json
{
  "storageId": "k123..."
}
```

### 3a) Register invoice

`POST /api/v1/invoices`

Body:

```json
{
  "monthKey": "2026-02",
  "storageId": "k123...",
  "fileName": "invoice.pdf"
}
```

### 3b) Register statement

`POST /api/v1/statements`

For PDF:

```json
{
  "monthKey": "2026-02",
  "storageId": "k123...",
  "fileName": "statement.pdf",
  "fileType": "pdf"
}
```

For CSV:

```json
{
  "monthKey": "2026-02",
  "storageId": "k123...",
  "fileName": "statement.csv",
  "fileType": "csv",
  "csvContent": "Date,Amount,..."
}
```

## End-to-end curl example (invoice)

```bash
API_BASE="https://<your-deployment>.convex.site"
API_KEY="sk_faktoora_..."
MONTH_KEY="2026-02"
FILE="invoice.pdf"

UPLOAD_URL=$(curl -sS -X POST "$API_BASE/api/v1/upload-url" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"kind":"invoice"}' | jq -r '.uploadUrl')

STORAGE_ID=$(curl -sS -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary "@$FILE" | jq -r '.storageId')

curl -sS -X POST "$API_BASE/api/v1/invoices" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"monthKey\":\"$MONTH_KEY\",\"storageId\":\"$STORAGE_ID\",\"fileName\":\"$FILE\"}"
```

## Validation rules

- `monthKey` must be `YYYY-MM`.
- Invoices: extensions `pdf`, `png`, `jpg`, `jpeg`, `webp`, max 20MB.
- Statements: `pdf` or `csv`, max 30MB, extension must match `fileType`.

## Common errors

- `401 Unauthorized`: missing/invalid API key.
- `403 Forbidden`: key exists but lacks required scope.
- `400 ...`: invalid payload or failed file validation.
- `405 Method not allowed`: wrong HTTP method.
