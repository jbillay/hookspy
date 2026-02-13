# API Contracts: Replay & Search

## POST /api/logs/:id/replay

**Purpose**: Create a replay of an existing webhook log

**Authentication**: Required (JWT Bearer token)

### Request

- **Method**: POST
- **URL**: `/api/logs/{id}/replay`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: None

### Response: 201 Created

```json
{
  "data": {
    "id": "uuid-of-new-log",
    "endpoint_id": "uuid",
    "status": "pending",
    "request_method": "POST",
    "request_url": "/webhook/stripe",
    "request_headers": { "Content-Type": "application/json" },
    "request_body": "{\"event\":\"payment.success\"}",
    "replayed_from": "uuid-of-original-log",
    "received_at": "2026-02-09T12:00:00Z"
  }
}
```

### Error Responses

| Status | Condition                          | Body                                       |
| ------ | ---------------------------------- | ------------------------------------------ |
| 401    | Invalid or missing auth token      | `{ "error": "Unauthorized" }`              |
| 404    | Log not found or not owned by user | `{ "error": "Log not found" }`             |
| 404    | Endpoint has been deleted          | `{ "error": "Endpoint no longer exists" }` |
| 405    | Method other than POST             | `{ "error": "Method not allowed" }`        |

### Behavior

1. Verify auth via JWT
2. Fetch original log with endpoint join (verify ownership)
3. Verify the endpoint still exists (not deleted)
4. Insert new webhook_log record:
   - Copy: `endpoint_id`, `request_method`, `request_url`, `request_headers`, `request_body`
   - Set: `id = gen_random_uuid()`, `status = 'pending'`, `received_at = now()`, `replayed_from = original.id`
5. Return the new log record

---

## GET /api/logs (Extended)

**Purpose**: List webhook logs with filtering, search, and pagination

**Authentication**: Required (JWT Bearer token)

### New Query Parameters

| Parameter   | Type     | Default | Description                                                                                   |
| ----------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| endpoint_id | uuid     | (none)  | Filter by endpoint (existing)                                                                 |
| page        | integer  | 1       | Page number (existing)                                                                        |
| limit       | integer  | 50      | Items per page, max 100 (existing)                                                            |
| method      | string   | (none)  | Comma-separated HTTP methods, e.g., `GET,POST`                                                |
| status      | string   | (none)  | Comma-separated statuses, e.g., `responded,error`                                             |
| from        | ISO 8601 | (none)  | Start of date range (inclusive)                                                               |
| to          | ISO 8601 | (none)  | End of date range (inclusive)                                                                 |
| q           | string   | (none)  | Text search (substring match against request_body, request_url, response_body, error_message) |

### Response: 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "endpoint_id": "uuid",
      "endpoint_name": "Stripe Webhooks",
      "endpoint_slug": "stripe",
      "status": "responded",
      "request_method": "POST",
      "request_url": "/webhook/stripe",
      "request_headers": {},
      "request_body": "...",
      "response_status": 200,
      "response_headers": {},
      "response_body": "...",
      "error_message": null,
      "received_at": "2026-02-09T12:00:00Z",
      "responded_at": "2026-02-09T12:00:01Z",
      "duration_ms": 1234,
      "replayed_from": null
    }
  ],
  "total": 42
}
```

### Filter Behavior

- All filters are AND-ed together
- `method`: `.in('request_method', methods)` — must match one of the selected methods
- `status`: `.in('status', statuses)` — must match one of the selected statuses
- `from`: `.gte('received_at', from)` — received at or after this time
- `to`: `.lte('received_at', to)` — received at or before this time
- `q`: `.or('request_body.ilike.%term%,request_url.ilike.%term%,response_body.ilike.%term%,error_message.ilike.%term%')` — substring match across multiple fields
