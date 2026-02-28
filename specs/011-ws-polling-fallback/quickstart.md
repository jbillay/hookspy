# Quickstart: WebSocket Polling Fallback

**Feature**: 011-ws-polling-fallback | **Date**: 2026-02-28

## What This Feature Does

Adds automatic HTTP polling fallback when WebSocket connections (Supabase Realtime) are blocked. The system detects WebSocket failure, switches to polling every 2 seconds, and auto-recovers when WebSocket becomes available again. A transport mode indicator shows the current connection state.

## Key Files

| File                                        | Role                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `src/composables/use-realtime-transport.js` | Centralized transport manager — all realtime subscriptions go through this |
| `api/poll/index.js`                         | Server-side polling endpoint — returns new/updated webhook logs            |
| `src/stores/relay.js`                       | Modified — uses transport composable instead of direct Supabase channel    |
| `src/stores/logs.js`                        | Modified — uses transport composable instead of direct Supabase channel    |
| `src/composables/use-dashboard.js`          | Modified — uses transport composable instead of direct Supabase channel    |
| `src/components/relay/RelayStatus.vue`      | Modified — shows transport mode (Connecting/Live/Polling)                  |
| `supabase/migrations/*_add_updated_at.sql`  | DB migration — adds `updated_at` column + trigger to `webhook_logs`        |

## How It Works

### Transport Composable (`use-realtime-transport.js`)

Singleton composable (module-level state, shared across all consumers). Provides:

```js
import { useRealtimeTransport } from '@/composables/use-realtime-transport.js'

const transport = useRealtimeTransport()

// Subscribe (replaces direct Supabase channel usage)
transport.subscribe(
  'relay-worker',
  {
    table: 'webhook_logs',
    events: ['INSERT'],
    endpointIds: ['uuid1', 'uuid2'],
  },
  (eventType, row) => {
    // eventType: 'INSERT' or 'UPDATE'
    // row: the webhook_log record
  },
)

// Unsubscribe
transport.unsubscribe('relay-worker')

// Reactive state
transport.transportMode // ref: 'connecting' | 'ws' | 'poll'
transport.isConnected // ref: boolean
```

### Detection Flow

1. On first `subscribe()`, attempts WebSocket via Supabase Realtime
2. Monitors `.subscribe()` status callback for failures
3. After 3 failures within 30 seconds → switches to polling mode
4. In polling mode, calls `GET /api/poll` every 2 seconds
5. Every 60 seconds, probes WebSocket with a test channel
6. If probe succeeds → switches back to WebSocket, stops polling

### Polling Endpoint (`GET /api/poll`)

```
GET /api/poll?since=2026-02-28T12:00:00.000Z&endpoint_ids=uuid1,uuid2
Authorization: Bearer <jwt>

Response:
{
  "inserts": [...],    // new logs since timestamp
  "updates": [...],    // modified logs since timestamp
  "server_time": "..." // use as 'since' for next poll
}
```

### UI Indicator States

| State        | Color           | Label           | When                                          |
| ------------ | --------------- | --------------- | --------------------------------------------- |
| Connecting   | Gray/Blue       | "Connecting..." | Initial startup, before transport is resolved |
| Live         | Green (pulsing) | "Connected"     | WebSocket active                              |
| Polling      | Amber           | "Polling"       | HTTP polling fallback active                  |
| Disconnected | Gray            | "Disconnected"  | Both transports failing                       |

## Testing

### Transport Composable Tests

- Mode switching: connecting → ws on success, connecting → poll on 3 failures
- Subscription management: register, dispatch, unsubscribe
- Deduplication: same log ID not dispatched twice
- Reconnect probe: poll → ws recovery
- Failure window: failures outside 30s window don't accumulate

### Polling Endpoint Tests

- Auth: rejects missing/invalid JWT
- Authorization: rejects endpoint IDs not owned by user
- Query: returns correct inserts and updates based on `since` timestamp
- Validation: rejects missing params, invalid UUIDs
- CORS: handles OPTIONS preflight

## Database Migration

The migration adds `updated_at` to `webhook_logs` with:

- Default value: `now()`
- Backfill: uses `COALESCE(responded_at, received_at)` for existing rows
- Trigger: auto-sets `updated_at = now()` on every UPDATE
- Index: `(endpoint_id, updated_at DESC)` for efficient polling queries
