# Quickstart: Browser Relay Engine

**Feature**: 006-browser-relay
**Date**: 2026-02-12

## Prerequisites

- Node.js installed
- HookSpy dev server running (`npm run dev`)
- Supabase project configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- At least one endpoint created via the Endpoints view
- A local development server running with CORS enabled (e.g., on `http://localhost:3000`)

## Files to Create

### New Files

| File                                              | Purpose                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `src/stores/relay.js`                             | Pinia store: relay state, subscription lifecycle, forwarding logic |
| `src/composables/use-relay.js`                    | Thin composable wrapper over relay store                           |
| `src/components/relay/RelayWorker.vue`            | Invisible component mounted in layout; starts/stops relay          |
| `src/components/relay/RelayStatus.vue`            | Status indicator (green/red/amber dot) for app header              |
| `supabase/migrations/XXXXXX_relay_rls_policy.sql` | RLS UPDATE policy for webhook_logs                                 |
| `tests/unit/stores/relay.test.js`                 | Unit tests for relay store                                         |
| `tests/unit/composables/use-relay.test.js`        | Unit tests for relay composable                                    |

### Modified Files

| File                                  | Change                                 |
| ------------------------------------- | -------------------------------------- |
| `src/components/layout/AppLayout.vue` | Mount `RelayWorker` when authenticated |
| `src/components/layout/AppHeader.vue` | Add `RelayStatus` indicator            |

## Implementation Order

1. **RLS migration** — Add UPDATE policy so browser can claim webhooks
2. **Relay store** (`relay.js`) — Core logic: subscribe, claim, forward, submit response
3. **Relay composable** (`use-relay.js`) — Thin wrapper
4. **RelayWorker component** — Mount in layout, start/stop relay on auth changes
5. **RelayStatus component** — Status dot in header
6. **Layout integration** — Wire RelayWorker into AppLayout, RelayStatus into AppHeader
7. **Tests** — Store and composable unit tests

## Verification Steps

1. Start dev server: `npm run dev`
2. Start a local test server on port 3000 with CORS enabled
3. Log in and create an endpoint
4. Verify the header shows "Relay Active" (green dot)
5. Send a webhook to the endpoint URL (e.g., via curl)
6. Verify the local server receives the forwarded request
7. Verify the webhook sender receives the local server's response
8. Stop the local server, send another webhook, verify error is reported
9. Open a second tab, send a webhook, verify only one tab forwards it

## Key Patterns

### Forwarding URL

```
http://localhost:3000/webhook
  └── target_url ─┘ └ port ┘└ target_path ┘
```

### Status Flow

```
Realtime INSERT (pending) → claim (forwarding) → fetch localhost → submit response (responded/error)
```

### Error Messages

- Connection refused: `"Connection refused: http://localhost:3000/webhook"`
- CORS error: `"CORS error: http://localhost:3000/webhook — Enable CORS on your local server"`
- Network error: `"Network error: {details}"`
