# Data Model: WebSocket Polling Fallback

**Feature**: 011-ws-polling-fallback | **Date**: 2026-02-28

## Schema Changes

### Modified Table: `webhook_logs`

**New column**:

| Column       | Type        | Default | Nullable | Notes                                    |
| ------------ | ----------- | ------- | -------- | ---------------------------------------- |
| `updated_at` | timestamptz | `now()` | NOT NULL | Auto-updated via trigger on every UPDATE |

**New index**:

| Index Name                          | Columns                          | Notes                                   |
| ----------------------------------- | -------------------------------- | --------------------------------------- |
| `idx_webhook_logs_endpoint_updated` | `(endpoint_id, updated_at DESC)` | Supports polling UPDATE detection query |

**New trigger**:

| Trigger Name                  | Event         | Function                                                   |
| ----------------------------- | ------------- | ---------------------------------------------------------- |
| `set_webhook_logs_updated_at` | BEFORE UPDATE | `trigger_set_updated_at()` — sets `NEW.updated_at = now()` |

The trigger function `trigger_set_updated_at()` may already exist (used by `endpoints` table). If so, reuse it. If not, create it.

### Migration SQL

```sql
-- Add updated_at column to webhook_logs
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows: use responded_at if available, else received_at
UPDATE public.webhook_logs
  SET updated_at = COALESCE(responded_at, received_at, now())
  WHERE updated_at = now();

-- Create or replace the trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on webhook_logs
DROP TRIGGER IF EXISTS set_webhook_logs_updated_at ON public.webhook_logs;
CREATE TRIGGER set_webhook_logs_updated_at
  BEFORE UPDATE ON public.webhook_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Add index for polling queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint_updated
  ON public.webhook_logs (endpoint_id, updated_at DESC);
```

## Client-Side Entities (In-Memory Only)

These are not persisted — they exist as reactive state in the transport composable.

### Transport Session

| Field                | Type                             | Description                                                           |
| -------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `mode`               | `'connecting' \| 'ws' \| 'poll'` | Current transport mode                                                |
| `isConnected`        | `boolean`                        | Whether events are being delivered (WS subscribed or poll succeeding) |
| `failureCount`       | `number`                         | Consecutive WS failures in current window                             |
| `failureWindowStart` | `number`                         | Timestamp (ms) of first failure in current sliding window             |
| `lastPollTime`       | `string \| null`                 | ISO timestamp from server's last poll response (`server_time`)        |
| `appLoadTime`        | `string`                         | ISO timestamp captured at composable initialization (initial cursor)  |

### Subscription Registration

| Field         | Type       | Description                                                        |
| ------------- | ---------- | ------------------------------------------------------------------ |
| `name`        | `string`   | Unique channel name (e.g., `'relay-worker'`, `'log-viewer'`)       |
| `table`       | `string`   | Target table (always `'webhook_logs'`)                             |
| `events`      | `string[]` | Event types: `['INSERT']`, `['UPDATE']`, or `['INSERT', 'UPDATE']` |
| `filter`      | `string`   | Endpoint ID filter string (e.g., `'endpoint_id=in.(uuid1,uuid2)'`) |
| `endpointIds` | `string[]` | Parsed endpoint IDs (used for polling API calls)                   |
| `callback`    | `function` | `(eventType: string, row: object) => void`                         |

### Dedup Cache

| Field     | Type          | Description                                           |
| --------- | ------------- | ----------------------------------------------------- |
| `seenIds` | `Set<string>` | Set of log IDs seen in recent polls (max 100 entries) |

## State Transitions

### Transport Mode

```
                    ┌──────────────────────┐
                    │     CONNECTING       │
                    │  (initial state)     │
                    └──────┬──────┬────────┘
                           │      │
                  WS OK    │      │  3 failures / 30s
                           │      │
                    ┌──────▼┐    ┌▼─────────┐
                    │  WS   │◄───│  POLL    │
                    │       │    │          │
                    └──┬────┘    └────┬─────┘
                       │              │
              WS fails │   reconnect  │ probe succeeds
              (3x/30s) │   probe      │
                       │              │
                    ┌──▼────┐    ┌────▼─────┐
                    │ POLL  │    │   WS     │
                    └───────┘    └──────────┘
```

### Failure Detection Window

1. First failure → record `failureWindowStart = Date.now()`, `failureCount = 1`
2. Subsequent failure within 30s of window start → increment `failureCount`
3. If `failureCount >= 3` → switch to `poll` mode
4. If 30s elapses since `failureWindowStart` without reaching 3 failures → reset window
5. On successful WS subscribe → reset `failureCount = 0`, clear window
