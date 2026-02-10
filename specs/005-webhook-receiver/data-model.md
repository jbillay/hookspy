# Data Model: Webhook Receiver

**Feature**: 005-webhook-receiver | **Date**: 2026-02-10

## Existing Entities (No Changes Required)

### endpoints

Already created in migration `20260209000001_create_tables.sql`. No schema changes needed.

| Column          | Type        | Constraints                   | Notes                 |
| --------------- | ----------- | ----------------------------- | --------------------- |
| id              | uuid        | PK, default gen_random_uuid() |                       |
| user_id         | uuid        | FK → auth.users, NOT NULL     | Owner                 |
| name            | text        |                               | Display name          |
| slug            | text        | UNIQUE, NOT NULL              | URL path segment      |
| target_url      | text        | default 'http://localhost'    | Local server base URL |
| target_port     | integer     | default 3000                  | Local server port     |
| target_path     | text        | default '/'                   | Local server path     |
| timeout_seconds | integer     | default 30, CHECK 1-55        | Polling timeout       |
| custom_headers  | jsonb       | default '{}'                  | Additive headers      |
| is_active       | boolean     | default true                  | Enabled flag          |
| created_at      | timestamptz | default now()                 |                       |
| updated_at      | timestamptz | default now()                 |                       |

**Indexes**: `idx_endpoints_slug` on `slug`, `idx_endpoints_user_id` on `user_id`

### webhook_logs

Already created in migration `20260209000001_create_tables.sql`. No schema changes needed.

| Column           | Type        | Constraints                                                               | Notes                              |
| ---------------- | ----------- | ------------------------------------------------------------------------- | ---------------------------------- |
| id               | uuid        | PK, default gen_random_uuid()                                             |                                    |
| endpoint_id      | uuid        | FK → endpoints ON DELETE CASCADE, NOT NULL                                | Parent endpoint                    |
| status           | text        | NOT NULL, CHECK IN ('pending','forwarding','responded','timeout','error') | Lifecycle state                    |
| request_method   | text        | NOT NULL                                                                  | HTTP method as received            |
| request_url      | text        |                                                                           | Full URL including query string    |
| request_headers  | jsonb       |                                                                           | All headers as JSON object         |
| request_body     | text        |                                                                           | Raw body (or base64 for binary)    |
| response_status  | integer     |                                                                           | HTTP status from local server      |
| response_headers | jsonb       |                                                                           | Response headers from local server |
| response_body    | text        |                                                                           | Response body from local server    |
| error_message    | text        |                                                                           | Error details if status is 'error' |
| received_at      | timestamptz | default now()                                                             | When webhook was received          |
| responded_at     | timestamptz |                                                                           | When response was submitted        |
| duration_ms      | integer     |                                                                           | responded_at - received_at in ms   |

**Index**: `idx_webhook_logs_endpoint_received` on `(endpoint_id, received_at DESC)`

## State Transitions

```
                    ┌──────────┐
   Webhook arrives  │ pending  │
                    └────┬─────┘
                         │
            Browser picks up log
                         │
                    ┌────▼─────┐
                    │forwarding│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        Local server   Error     Timeout
        responds     occurred    exceeded
              │          │          │
        ┌─────▼──┐  ┌───▼───┐  ┌──▼────┐
        │responded│  │ error │  │timeout│
        └────────┘  └───────┘  └───────┘
```

**Transition rules**:

- `pending` → `forwarding`: Browser relay acknowledges pickup
- `pending` → `timeout`: Polling loop exceeds `timeout_seconds` (no browser connected)
- `forwarding` → `responded`: Browser submits successful local server response
- `forwarding` → `error`: Browser submits error (connection refused, CORS, etc.)
- `forwarding` → `timeout`: Polling loop exceeds `timeout_seconds` (local server too slow)

**Invariants**:

- Once status is `responded`, `timeout`, or `error`, it cannot change (terminal states)
- `response_status`, `response_headers`, `response_body` are only set when status becomes `responded`
- `error_message` is only set when status becomes `error`
- `responded_at` and `duration_ms` are set for both `responded` and `error` transitions

## RLS Policies (Existing)

- **webhook_logs INSERT**: No RLS policy — inserts happen via service role (serverless function)
- **webhook_logs SELECT**: Users can read logs for their own endpoints
- **webhook_logs UPDATE**: Users can update logs for their own endpoints (response submission)
- **No DELETE policy**: Logs removed only by pg_cron cleanup job

## Data Volume Assumptions

- Log retention: 24 hours (pg_cron hourly cleanup)
- Expected volume: Low (single-user dev tool, <1000 logs/day typical)
- Max body size: 1MB per request/response
