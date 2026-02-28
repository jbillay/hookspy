# API Contract: Polling Endpoint

**Feature**: 011-ws-polling-fallback | **Date**: 2026-02-28

## `GET /api/poll`

Poll for new and updated webhook log entries since a given timestamp.

### Request

**Method**: `GET`
**Authentication**: Required — `Authorization: Bearer <jwt>`
**CORS**: Standard (same as all API endpoints)

**Query Parameters**:

| Parameter      | Type                  | Required | Description                                                                                                             |
| -------------- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `since`        | ISO 8601 string       | Yes      | Fetch events after this timestamp. Use `server_time` from previous poll response, or app-load timestamp for first poll. |
| `endpoint_ids` | Comma-separated UUIDs | Yes      | Endpoint IDs to poll for. Must all belong to the authenticated user.                                                    |

**Example**:

```
GET /api/poll?since=2026-02-28T12:00:00.000Z&endpoint_ids=uuid1,uuid2,uuid3
Authorization: Bearer eyJhbGciOi...
```

### Response

**Success (200)**:

```json
{
  "inserts": [
    {
      "id": "uuid",
      "endpoint_id": "uuid",
      "status": "pending",
      "request_method": "POST",
      "request_url": "https://hookspy.dev/hook/my-endpoint",
      "request_headers": {},
      "request_body": "...",
      "request_subpath": "/sub/path",
      "received_at": "2026-02-28T12:00:01.000Z",
      "updated_at": "2026-02-28T12:00:01.000Z"
    }
  ],
  "updates": [
    {
      "id": "uuid",
      "endpoint_id": "uuid",
      "status": "responded",
      "response_status": 200,
      "response_headers": {},
      "response_body": "...",
      "responded_at": "2026-02-28T12:00:02.500Z",
      "updated_at": "2026-02-28T12:00:02.500Z",
      "duration_ms": 1500
    }
  ],
  "server_time": "2026-02-28T12:00:03.000Z"
}
```

| Field         | Type            | Description                                                                                                       |
| ------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `inserts`     | array           | Webhook logs created after `since` (new incoming webhooks). Ordered by `received_at ASC`.                         |
| `updates`     | array           | Webhook logs modified after `since` but created before `since` (status transitions). Ordered by `updated_at ASC`. |
| `server_time` | ISO 8601 string | Server timestamp to use as `since` for the next poll request.                                                     |

**Insert query logic**:

```sql
SELECT * FROM webhook_logs
WHERE received_at > $since
  AND endpoint_id = ANY($endpoint_ids)
ORDER BY received_at ASC
LIMIT 100
```

**Update query logic**:

```sql
SELECT * FROM webhook_logs
WHERE updated_at > $since
  AND received_at <= $since
  AND endpoint_id = ANY($endpoint_ids)
ORDER BY updated_at ASC
LIMIT 100
```

### Error Responses

| Status | Body                                                      | Condition                                                       |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------- |
| 400    | `{ "error": "Missing required parameter: since" }`        | `since` param missing or invalid                                |
| 400    | `{ "error": "Missing required parameter: endpoint_ids" }` | `endpoint_ids` param missing or empty                           |
| 400    | `{ "error": "Invalid endpoint_ids format" }`              | IDs are not valid UUIDs                                         |
| 401    | `{ "error": "..." }`                                      | JWT missing, invalid, or expired                                |
| 403    | `{ "error": "Unauthorized endpoint access" }`             | One or more endpoint IDs don't belong to the authenticated user |
| 405    | `{ "error": "Method not allowed" }`                       | Non-GET request                                                 |
| 500    | `{ "error": "Internal server error" }`                    | Database query failure                                          |

### Authorization Logic

1. Verify JWT via `verifyAuth(req)` — same as all existing endpoints.
2. Query `endpoints` table: `SELECT id FROM endpoints WHERE id = ANY($endpoint_ids) AND user_id = $user_id`.
3. If the count of matching rows does not equal the count of requested IDs → return 403.
4. Proceed with polling queries using the validated endpoint IDs.

### Rate Limiting Considerations

No server-side rate limiting is implemented in this feature. The 2-second client-side polling interval is the primary throttle mechanism. If rate limiting becomes necessary in the future, it can be added at the Vercel or middleware level without changing this contract.

### Response Size Limits

Each query is limited to 100 rows. If more than 100 inserts or updates occur within a single poll cycle (2 seconds), the client will catch the remainder on subsequent polls since the `server_time` cursor advances only to the current time, not past the returned results. This is acceptable for the expected traffic patterns (individual developer usage, not high-throughput systems).
