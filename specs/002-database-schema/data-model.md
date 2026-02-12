# Data Model: Database Schema & Supabase Setup

**Feature**: 002-database-schema
**Date**: 2026-02-09

## Entity Relationship Diagram

```
┌─────────────────────┐
│     auth.users      │  (Supabase managed)
│─────────────────────│
│  id (uuid PK)       │
│  email              │
│  ...                │
└─────────┬───────────┘
          │ 1
          │
          │ N
┌─────────┴───────────┐         ┌─────────────────────────┐
│     endpoints       │  1   N  │     webhook_logs        │
│─────────────────────│────────>│─────────────────────────│
│  id (uuid PK)       │         │  id (uuid PK)           │
│  user_id (uuid FK)  │         │  endpoint_id (uuid FK)  │
│  name (text)        │         │  status (text)          │
│  slug (text, UQ)    │         │  request_method (text)  │
│  target_url (text)  │         │  request_url (text)     │
│  target_port (int)  │         │  request_headers (jsonb)│
│  target_path (text) │         │  request_body (text)    │
│  timeout_seconds    │         │  response_status (int)  │
│  custom_headers     │         │  response_headers(jsonb)│
│  is_active (bool)   │         │  response_body (text)   │
│  created_at (tstz)  │         │  error_message (text)   │
│  updated_at (tstz)  │         │  received_at (tstz)     │
└─────────────────────┘         │  responded_at (tstz)    │
                                │  duration_ms (int)      │
                                └─────────────────────────┘
```

## Entity: endpoints

Represents a user's webhook receiving URL with forwarding configuration.

| Column          | Type        | Constraints               | Default            | Description                           |
| --------------- | ----------- | ------------------------- | ------------------ | ------------------------------------- |
| id              | uuid        | PK                        | gen_random_uuid()  | Unique identifier                     |
| user_id         | uuid        | FK → auth.users, NOT NULL | —                  | Owner of the endpoint                 |
| name            | text        | —                         | —                  | Human-readable label                  |
| slug            | text        | UNIQUE, NOT NULL          | —                  | URL path segment for webhook URL      |
| target_url      | text        | —                         | 'http://localhost' | Local dev server URL                  |
| target_port     | integer     | —                         | 3000               | Local dev server port                 |
| target_path     | text        | —                         | '/'                | Path on local dev server              |
| timeout_seconds | integer     | CHECK (1..55)             | 30                 | Max wait time for relay response      |
| custom_headers  | jsonb       | —                         | '{}'               | Additional headers to inject          |
| is_active       | boolean     | —                         | true               | Whether endpoint accepts webhooks     |
| created_at      | timestamptz | —                         | now()              | Record creation time                  |
| updated_at      | timestamptz | —                         | now()              | Last modification time (auto-trigger) |

**Indexes**:

- `idx_endpoints_slug` on `(slug)` — fast webhook URL lookup
- `idx_endpoints_user_id` on `(user_id)` — fast user endpoint listing, RLS performance

**Triggers**:

- `set_updated_at` BEFORE UPDATE — auto-updates `updated_at` to `now()`

**Relationships**:

- Belongs to `auth.users` via `user_id`
- Has many `webhook_logs` via `endpoint_id`

## Entity: webhook_logs

Represents a single webhook request/response lifecycle.

| Column           | Type        | Constraints                                | Default           | Description                          |
| ---------------- | ----------- | ------------------------------------------ | ----------------- | ------------------------------------ |
| id               | uuid        | PK                                         | gen_random_uuid() | Unique identifier                    |
| endpoint_id      | uuid        | FK → endpoints ON DELETE CASCADE, NOT NULL | —                 | Parent endpoint                      |
| status           | text        | NOT NULL, CHECK in set                     | —                 | Lifecycle state                      |
| request_method   | text        | NOT NULL                                   | —                 | HTTP method (GET, POST, etc.)        |
| request_url      | text        | —                                          | —                 | Original request URL                 |
| request_headers  | jsonb       | —                                          | —                 | Original request headers             |
| request_body     | text        | —                                          | —                 | Original request body                |
| response_status  | integer     | —                                          | —                 | Response HTTP status code            |
| response_headers | jsonb       | —                                          | —                 | Response headers from local server   |
| response_body    | text        | —                                          | —                 | Response body from local server      |
| error_message    | text        | —                                          | —                 | Error details if status is 'error'   |
| received_at      | timestamptz | —                                          | now()             | When webhook was received            |
| responded_at     | timestamptz | —                                          | —                 | When response was sent back          |
| duration_ms      | integer     | —                                          | —                 | Total relay duration in milliseconds |

**Status values**: `pending` → `forwarding` → `responded` | `timeout` | `error`

**Indexes**:

- `idx_webhook_logs_endpoint_received` on `(endpoint_id, received_at DESC)` — efficient log listing

**Relationships**:

- Belongs to `endpoints` via `endpoint_id` (CASCADE delete)

## State Transitions: webhook_logs.status

```
                    ┌──────────┐
       INSERT ──>   │ pending  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │forwarding│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼───┐
         │responded│ │timeout │ │error │
         └────────┘ └────────┘ └──────┘
```

- **pending**: Webhook received and stored, waiting for browser pickup
- **forwarding**: Browser has received the event and is forwarding to localhost
- **responded**: Local server responded, response relayed back to caller
- **timeout**: No response received within the endpoint's timeout_seconds
- **error**: An error occurred during forwarding (e.g., localhost unreachable)

## RLS Policies

### endpoints table

| Operation | Policy                     | Condition              |
| --------- | -------------------------- | ---------------------- |
| SELECT    | User sees own endpoints    | `auth.uid() = user_id` |
| INSERT    | User creates own endpoints | `auth.uid() = user_id` |
| UPDATE    | User updates own endpoints | `auth.uid() = user_id` |
| DELETE    | User deletes own endpoints | `auth.uid() = user_id` |

### webhook_logs table

| Operation | Policy                              | Condition                                                              |
| --------- | ----------------------------------- | ---------------------------------------------------------------------- |
| SELECT    | User sees logs for own endpoints    | `endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())` |
| UPDATE    | User updates logs for own endpoints | `endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())` |
| INSERT    | —                                   | No policy (service role only)                                          |
| DELETE    | —                                   | No policy (cleanup job only)                                           |

## Realtime Publication

Only `webhook_logs` is published to `supabase_realtime`. Clients subscribe filtered by `endpoint_id`. Events respect RLS policies automatically.

## Scheduled Cleanup

Hourly pg_cron job deletes `webhook_logs` where `received_at < now() - interval '24 hours'`. Runs as superuser, bypasses RLS.
