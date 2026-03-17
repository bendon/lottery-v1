# MSISDN Decode API

Built-in endpoint for decoding Safaricom C2B hashed phone numbers. Compatible with [mpesa-hash-decoder](https://github.com/mwangikibui/mpesa-hash-decoder) format.

## Endpoint

```
POST /api/msisdn/decode
```

**Full URL (production):** `https://l-gain-v1.payl.to/api/msisdn/decode`

## Request

| Header | Value |
|--------|-------|
| Content-Type | application/json |

**Body:**
```json
{
  "hashedPhone": "<64-char-sha256-hex>",
  "algo": "Sha256"
}
```

## Response (success)

```json
{
  "success": true,
  "message": "Decoded successfully",
  "data": {
    "_id": "<lookup-id>",
    "telco": "safaricom",
    "phone": "254712345678",
    "sha256Hash": "<hash>"
  }
}
```

## Response (not found)

```json
{
  "success": false,
  "message": "No phone found for hash",
  "data": null
}
```

## Response (invalid hash)

```json
{
  "success": false,
  "message": "Invalid hash format. Expected 64-char hex.",
  "data": null
}
```

## How it works

The lookup table is populated when we receive plain phone numbers from:

- **STK Push** — PhoneNumber in callback metadata
- **C2B** — MSISDN when Safaricom sends plain (before hashing)

We hash each phone with SHA-256 (254 format) and store `hash → phone`. When you send a hash, we look it up.

## cURL example

```bash
curl -X POST "https://l-gain-v1.payl.to/api/msisdn/decode" \
  -H "Content-Type: application/json" \
  -d '{"hashedPhone":"a1b2c3d4e5f6...","algo":"Sha256"}'
```

## Use with mpesa-hash-decoder

Set `DECODE_MSISDN_URL` in your Node app:

```env
DECODE_MSISDN_URL=https://l-gain-v1.payl.to/api/msisdn/decode
```

## Self-reference

To use our built-in decode when showing winner details, set in Admin → Settings → M-Pesa:

```
DECODE_MSISDN_URL = https://l-gain-v1.payl.to/api/msisdn/decode
```

Or in `.env`:

```
MPESA_DECODE_MSISDN_URL=https://l-gain-v1.payl.to/api/msisdn/decode
```
