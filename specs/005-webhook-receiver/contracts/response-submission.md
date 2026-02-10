# API Contract: Response Submission

**Endpoint**: `POST /api/logs/[id]/response`
**Auth**: Required (Bearer JWT)
**Purpose**: Accept a local server's response (or error) from the browser relay and store it against the webhook log.

## Request

**URL Parameters**:

- `id` (uuid, required): The webhook log ID

**Headers**:

- `Authorization: Bearer <jwt>` (required)
- `Content-Type: application/json` (required)

**Body (success response)**:

```json
{
  "status": 200,
  "headers": {
    "Content-Type": "application/json",
    "X-Custom": "value"
  },
  "body": "response body string"
}
```

**Body (error response)**:

```json
{
  "error": "Connection refused: localhost:3000"
}
```

## Responses

### 200 — Response Accepted

```json
{
  "success": true,
  "log_id": "uuid",
  "status": "responded",
  "duration_ms": 1234
}
```

Returned when the response is successfully stored and the log status is updated.

### 200 — Error Recorded

```json
{
  "success": true,
  "log_id": "uuid",
  "status": "error",
  "duration_ms": 1234
}
```

Returned when an error report is successfully recorded.

### 400 — Bad Request

```json
{
  "error": "Request body must include either {status, headers, body} or {error}"
}
```

Returned when the request body is missing required fields.

### 401 — Unauthorized

```json
{
  "error": "Missing or invalid Authorization header"
}
```

or

```json
{
  "error": "Invalid or expired token"
}
```

### 403 — Forbidden

```json
{
  "error": "You do not own this endpoint"
}
```

Returned when the authenticated user does not own the endpoint associated with the log.

### 404 — Not Found

```json
{
  "error": "Log not found"
}
```

### 405 — Method Not Allowed

```json
{
  "error": "Method not allowed"
}
```

Returned for any HTTP method other than POST (and OPTIONS for CORS).

### 409 — Conflict

```json
{
  "error": "Log already resolved"
}
```

Returned when the log is already in a terminal state (`responded`, `timeout`, or `error`).

## Behavior

1. Handle CORS preflight (OPTIONS)
2. Reject non-POST methods with 405
3. Verify JWT authentication
4. Look up webhook log by ID (with endpoint join to get user_id)
5. Verify authenticated user owns the endpoint
6. Verify log status is `pending` or `forwarding`
7. If request body contains `error`:
   - Update log: `status = 'error'`, `error_message`, `responded_at = now()`, `duration_ms`
8. If request body contains `status`, `headers`, `body`:
   - Update log: `status = 'responded'`, `response_status`, `response_headers`, `response_body`, `responded_at = now()`, `duration_ms`
9. Return success with log details
