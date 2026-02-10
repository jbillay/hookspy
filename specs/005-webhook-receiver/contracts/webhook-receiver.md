# API Contract: Webhook Receiver

**Endpoint**: `ANY /api/hook/[slug]`
**Auth**: None (public endpoint)
**Purpose**: Receive external webhook requests, store them, poll for browser-submitted responses, and return the response to the caller.

## Request

**URL Parameters**:

- `slug` (string, required): The endpoint's unique slug identifier

**Headers**: All headers are captured and stored. No specific headers required.

**Query String**: Fully preserved in `request_url`.

**Body**: Raw body of any content type, up to 1MB. Body parsing is disabled; raw bytes are stored as-is.

## Responses

### 200 (or relayed status) — Successful Relay

Returned when the browser relay submits a response within the timeout.

The response status code, headers, and body are exactly as returned by the local development server.

```
HTTP/1.1 {response_status}
{response_headers as individual headers}

{response_body}
```

### 404 — Endpoint Not Found

```json
{
  "error": "Endpoint not found"
}
```

Returned when:

- The slug does not match any endpoint
- The endpoint exists but `is_active` is `false`

### 413 — Payload Too Large

```json
{
  "error": "Payload Too Large"
}
```

Returned when the request body exceeds 1MB. No log entry is created.

### 429 — Too Many Requests

```json
{
  "error": "Too Many Requests"
}
```

Returned when the endpoint has received more than 60 requests in the current minute. No log entry is created.

### 504 — Gateway Timeout

```json
{
  "error": "Gateway Timeout",
  "message": "Local server did not respond within {timeout}s"
}
```

Returned when the polling loop exceeds the endpoint's `timeout_seconds` without receiving a response from the browser relay.

## Behavior

1. Validate body size (reject if > 1MB)
2. Look up endpoint by `slug` where `is_active = true`
3. Check rate limit (reject if > 60/min for this slug)
4. Insert `webhook_logs` record with status `pending`
5. Enter polling loop (500ms interval):
   - Query log by ID
   - If status is `responded`: return stored response to caller
   - If status is `error`: return 502 with error message
   - If elapsed time > `timeout_seconds`: update status to `timeout`, return 504
   - If status is `pending` or `forwarding`: continue polling
6. CORS headers are set on all responses

## Configuration

```javascript
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
}
```
