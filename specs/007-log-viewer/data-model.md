# Data Model: Log Viewer

## Existing Database Schema (No Changes Required)

The `webhook_logs` table already exists with all required fields from feature 002 (database schema). No new migrations are needed.

### webhook_logs Table

| Column           | Type                  | Description                                    |
| ---------------- | --------------------- | ---------------------------------------------- |
| id               | uuid (PK)             | Unique log identifier                          |
| endpoint_id      | uuid (FK → endpoints) | Associated endpoint                            |
| status           | text                  | pending, forwarding, responded, timeout, error |
| request_method   | text                  | HTTP method (GET, POST, etc.)                  |
| request_url      | text                  | Full request URL                               |
| request_headers  | jsonb                 | Request headers as JSON object                 |
| request_body     | text                  | Request body (raw)                             |
| response_status  | integer               | HTTP response status code                      |
| response_headers | jsonb                 | Response headers as JSON object                |
| response_body    | text                  | Response body (raw)                            |
| error_message    | text                  | Error description (when status = error)        |
| received_at      | timestamptz           | When the webhook was received                  |
| responded_at     | timestamptz           | When the response was submitted                |
| duration_ms      | integer               | Response time in milliseconds                  |

### Indexes

- `idx_webhook_logs_endpoint_received` on `(endpoint_id, received_at DESC)` — supports per-endpoint log queries ordered by time

### RLS Policies (Already Configured)

- SELECT: Authenticated users can read logs where `endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())`
- UPDATE: Authenticated users can update status on their own logs (used by relay)

## Pinia Store State: logs.js

```
logs: []              // Array of webhook_log objects for current view
currentLog: null      // Single log for expanded detail (if needed for full fetch)
loading: false        // Loading state for initial fetch
error: null           // Error message string
totalCount: 0         // Total number of logs matching current filter (for pagination)
currentPage: 1        // Current page number
pageSize: 50          // Items per page (default 50)
endpointFilter: null  // Filter by endpoint_id (null = all endpoints)
channel: null         // Supabase Realtime channel reference
```

## Status Display Mapping

| Status     | Badge Color | Badge Style       | Display Text  |
| ---------- | ----------- | ----------------- | ------------- |
| pending    | Blue        | Solid             | Pending       |
| forwarding | Blue        | Pulsing animation | Forwarding... |
| responded  | Green       | Solid             | Responded     |
| timeout    | Orange      | Solid             | Timeout       |
| error      | Red         | Solid             | Error         |

## Duration Formatting

| Duration (ms)             | Display                 |
| ------------------------- | ----------------------- |
| < 1000                    | "{n}ms" (e.g., "234ms") |
| >= 1000                   | "{n.n}s" (e.g., "1.2s") |
| null (pending/forwarding) | "—"                     |

## Realtime Subscription Events

The logs store subscribes to `postgres_changes` on `webhook_logs`:

- **INSERT**: New log arrives → prepend to `logs` array if on page 1, increment `totalCount`
- **UPDATE**: Status change → find log by ID in `logs` array and merge updated fields (status, response\_\*, duration_ms, responded_at, error_message)
