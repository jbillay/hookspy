# Data Model: Browser Relay Engine

**Feature**: 006-browser-relay
**Date**: 2026-02-12

## Existing Entities (No Changes)

### endpoints

The relay reads endpoint configuration but does not modify the schema.

| Field          | Type    | Used By Relay                             |
| -------------- | ------- | ----------------------------------------- |
| id             | uuid    | Filter for Realtime subscription          |
| target_url     | text    | Construct forwarding URL                  |
| target_port    | integer | Construct forwarding URL                  |
| target_path    | text    | Construct forwarding URL                  |
| custom_headers | jsonb   | Merge into forwarding request headers     |
| is_active      | boolean | Determine which endpoints to subscribe to |
| user_id        | uuid    | RLS ownership verification                |

### webhook_logs

The relay reads incoming logs and updates status. No schema changes needed.

| Field           | Type  | Used By Relay                                                |
| --------------- | ----- | ------------------------------------------------------------ |
| id              | uuid  | Identify log for status update and response submission       |
| endpoint_id     | uuid  | Look up endpoint config for forwarding                       |
| status          | text  | Check/update: `pending` → `forwarding` → `responded`/`error` |
| request_method  | text  | Forward to localhost with same method                        |
| request_headers | jsonb | Forward to localhost (minus forbidden headers)               |
| request_body    | text  | Forward to localhost as request body                         |

## State Machine: webhook_log.status (Relay Perspective)

```
                    ┌──────────┐
   Realtime INSERT  │ pending  │
   notification     └────┬─────┘
                         │
            Browser claims (UPDATE status)
            If already claimed → SKIP
                         │
                    ┌────▼─────┐
                    │forwarding│
                    └────┬─────┘
                         │
              ┌──────────┴──────────┐
              │                     │
        fetch succeeds         fetch fails
              │                     │
     ┌────────▼────────┐   ┌───────▼───────┐
     │   responded     │   │    error      │
     │ (via API POST)  │   │ (via API POST)│
     └─────────────────┘   └───────────────┘
```

**Status transitions owned by the relay**:

- `pending` → `forwarding`: Direct Supabase update from browser (conditional on current status being `pending`)
- `forwarding` → `responded`: Via `POST /api/logs/:id/response` with `{ status, headers, body }`
- `forwarding` → `error`: Via `POST /api/logs/:id/response` with `{ error: "message" }`

**Status transitions owned by other components**:

- `pending` → `timeout`: Server-side webhook receiver (polling timeout)
- Initial INSERT with `pending`: Server-side webhook receiver

## New RLS Policy Required

An UPDATE policy on `webhook_logs` is needed to allow the browser to claim webhooks by updating `status` from `pending` to `forwarding`.

```sql
CREATE POLICY "Users can update own webhook log status"
  ON webhook_logs FOR UPDATE
  USING (
    endpoint_id IN (
      SELECT id FROM endpoints WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM endpoints WHERE user_id = auth.uid()
    )
  );
```

## Client-Side State (Pinia Store)

### relayStore

| State           | Type            | Description                                                     |
| --------------- | --------------- | --------------------------------------------------------------- |
| relayStatus     | ref('inactive') | Current relay state: `'active'`, `'inactive'`, `'no-endpoints'` |
| forwardingCount | ref(0)          | Number of webhooks currently being forwarded                    |
| lastError       | ref(null)       | Most recent relay error message                                 |
| channel         | ref(null)       | Active Supabase Realtime channel (internal)                     |

| Action                        | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| startRelay()                  | Subscribe to Realtime for user's active endpoints |
| stopRelay()                   | Unsubscribe and clean up channel                  |
| updateSubscription()          | Re-subscribe when endpoint list changes           |
| forwardWebhook(log, endpoint) | Claim, forward to localhost, submit response      |

## Forwarding URL Construction

The target URL for each forwarding request is built from endpoint config:

```
{target_url}:{target_port}{target_path}
```

Examples:

- `http://localhost:3000/webhook` (defaults)
- `http://localhost:8080/api/hooks/stripe`
- `http://127.0.0.1:4000/`
