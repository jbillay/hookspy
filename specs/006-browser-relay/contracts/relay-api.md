# API Contracts: Browser Relay Engine

**Feature**: 006-browser-relay
**Date**: 2026-02-12

## Overview

The Browser Relay Engine does not introduce new API endpoints. It consumes:

1. **Existing** `POST /api/logs/:id/response` — to submit relay results
2. **Existing** Supabase Realtime — to receive webhook notifications
3. **New** Supabase client-side UPDATE — to claim webhooks (status: `pending` → `forwarding`)

---

## Consumed Endpoint: POST /api/logs/:id/response

**Purpose**: Browser submits the local server's response (or error) after forwarding.

### Request — Success Response

```http
POST /api/logs/{log_id}/response
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "status": 200,
  "headers": {
    "Content-Type": "application/json",
    "X-Custom": "value"
  },
  "body": "{\"ok\": true}"
}
```

### Request — Error Report

```http
POST /api/logs/{log_id}/response
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "error": "Connection refused: http://localhost:3000/webhook"
}
```

### Response — Success (200)

```json
{
  "success": true,
  "log_id": "uuid",
  "status": "responded",
  "duration_ms": 245
}
```

### Response — Already Claimed (409)

```json
{
  "error": "Log already resolved with status: forwarding"
}
```

### Error Responses

| Status | Condition                      |
| ------ | ------------------------------ |
| 401    | Missing or invalid JWT         |
| 403    | User does not own the endpoint |
| 404    | Log ID not found               |
| 405    | Method not POST                |
| 409    | Log already in terminal status |

---

## Supabase Realtime Subscription Contract

### Channel Configuration

```javascript
{
  channelName: 'relay-worker',
  event: 'INSERT',
  schema: 'public',
  table: 'webhook_logs',
  filter: 'endpoint_id=in.(uuid1,uuid2,...)'
}
```

### Payload Shape (postgres_changes INSERT)

```javascript
{
  eventType: 'INSERT',
  new: {
    id: 'uuid',
    endpoint_id: 'uuid',
    status: 'pending',
    request_method: 'POST',
    request_url: 'https://hookspy.app/api/hook/abc123',
    request_headers: { "Content-Type": "application/json", ... },
    request_body: '{"event": "payment.success"}',
    received_at: '2026-02-12T10:30:00.000Z'
  },
  old: {}
}
```

---

## Supabase Client-Side Update Contract (Webhook Claim)

### Operation

```javascript
const { data, error } = await supabase
  .from('webhook_logs')
  .update({ status: 'forwarding' })
  .eq('id', logId)
  .eq('status', 'pending')
  .select()
```

### Expected Results

| Outcome         | `data`                                | `error`              | Meaning                        |
| --------------- | ------------------------------------- | -------------------- | ------------------------------ |
| Claimed         | `[{ id, status: 'forwarding', ... }]` | null                 | This tab owns forwarding       |
| Already claimed | `[]` (empty array)                    | null                 | Another tab already claimed it |
| RLS denied      | null                                  | `{ message: '...' }` | User doesn't own this endpoint |

---

## Forwarding Request Contract (Browser → Localhost)

### Request Construction

```javascript
fetch(`${target_url}:${target_port}${target_path}`, {
  method: request_method,
  headers: {
    ...filteredRequestHeaders, // original minus forbidden headers
    ...custom_headers, // endpoint's custom headers (precedence)
  },
  body: ['GET', 'HEAD'].includes(request_method) ? undefined : request_body,
  mode: 'cors',
})
```

### Forbidden Headers (Silently Skipped)

Headers matching any of these are removed before forwarding:

- `Host`, `Origin`, `Referer`, `Cookie`, `Cookie2`
- `Content-Length`, `Connection`, `Keep-Alive`
- `Accept-Charset`, `Accept-Encoding`
- `Transfer-Encoding`, `TE`, `Trailer`, `Upgrade`, `Via`
- `Date`, `DNT`, `Expect`
- `Access-Control-Request-Headers`, `Access-Control-Request-Method`
- `Set-Cookie`
- Any header starting with `Proxy-` or `Sec-`

### Response Capture

```javascript
{
  status: response.status,           // e.g., 200
  headers: Object.fromEntries(       // response headers as plain object
    response.headers.entries()
  ),
  body: await response.text()        // response body as string
}
```

### Error Classification

| Error Type         | Detection                        | Error Message Format                                   |
| ------------------ | -------------------------------- | ------------------------------------------------------ |
| Connection refused | `TypeError` with "fetch"         | `Connection refused: {url}`                            |
| CORS error         | `TypeError` with opaque response | `CORS error: {url} — Enable CORS on your local server` |
| Network error      | Other `TypeError`                | `Network error: {error.message}`                       |
