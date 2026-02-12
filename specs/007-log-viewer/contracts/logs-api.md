# API Contracts: Log Viewer

## GET /api/logs

List webhook logs with optional filtering and pagination.

### Request

**Headers**:

- `Authorization: Bearer <token>` (required)

**Query Parameters**:

| Parameter   | Type    | Default | Description                                                           |
| ----------- | ------- | ------- | --------------------------------------------------------------------- |
| endpoint_id | uuid    | (none)  | Filter by endpoint. If omitted, returns logs for all user's endpoints |
| page        | integer | 1       | Page number (1-based)                                                 |
| limit       | integer | 50      | Items per page (max 100)                                              |

### Response: 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "endpoint_id": "uuid",
      "endpoint_name": "string",
      "endpoint_slug": "string",
      "status": "pending|forwarding|responded|timeout|error",
      "request_method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
      "request_url": "string",
      "request_headers": {},
      "request_body": "string|null",
      "response_status": 200,
      "response_headers": {},
      "response_body": "string|null",
      "error_message": "string|null",
      "received_at": "2026-02-12T10:00:00Z",
      "responded_at": "2026-02-12T10:00:01Z",
      "duration_ms": 234
    }
  ],
  "total": 142
}
```

### Response: 401 Unauthorized

```json
{
  "error": "Missing or invalid Authorization header"
}
```

### Notes

- Results ordered by `received_at DESC` (newest first)
- Only returns logs for endpoints owned by the authenticated user
- Endpoint name and slug are joined from the endpoints table for display in the combined view
- Pagination offset calculated as `(page - 1) * limit`

---

## GET /api/logs/:id

Get a single webhook log with full details.

### Request

**Headers**:

- `Authorization: Bearer <token>` (required)

**Path Parameters**:

- `id` (uuid) — Log ID

### Response: 200 OK

```json
{
  "data": {
    "id": "uuid",
    "endpoint_id": "uuid",
    "endpoint_name": "string",
    "endpoint_slug": "string",
    "status": "responded",
    "request_method": "POST",
    "request_url": "/hook/my-endpoint",
    "request_headers": {
      "content-type": "application/json",
      "x-webhook-signature": "sha256=..."
    },
    "request_body": "{\"event\":\"payment.completed\"}",
    "response_status": 200,
    "response_headers": {
      "content-type": "application/json"
    },
    "response_body": "{\"status\":\"ok\"}",
    "error_message": null,
    "received_at": "2026-02-12T10:00:00Z",
    "responded_at": "2026-02-12T10:00:01Z",
    "duration_ms": 234
  }
}
```

### Response: 404 Not Found

```json
{
  "error": "Log not found"
}
```

### Notes

- Ownership validated via endpoint join: log's endpoint must belong to authenticated user
- Returns full request and response data including headers and bodies
