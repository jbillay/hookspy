# Tasks: WebSocket Polling Fallback

**Input**: Design documents from `/specs/011-ws-polling-fallback/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes required before any feature code can work

- [x] T001 Create database migration to add `updated_at` column, trigger function, trigger, and composite index to `webhook_logs` table in `supabase/migrations/20260228000001_add_webhook_logs_updated_at.sql` — use the exact SQL from data-model.md (column with DEFAULT now(), backfill existing rows with COALESCE(responded_at, received_at, now()), CREATE OR REPLACE trigger_set_updated_at() function, BEFORE UPDATE trigger, and idx_webhook_logs_endpoint_updated index)
- [x] T002 Apply the migration to the Supabase project using the Supabase MCP `apply_migration` tool and verify the column, trigger, and index exist by running a test query

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create the polling API endpoint in `api/poll/index.js` following the contract in `contracts/poll-api.md` — implement the handler with: CORS handling via `api/_lib/cors.js`, JWT auth via `api/_lib/auth.js` `verifyAuth()`, query parameter validation (`since` as ISO timestamp, `endpoint_ids` as comma-separated UUIDs), endpoint ownership check (query `endpoints` table for `id IN ($ids) AND user_id = $userId`, reject with 403 if count mismatch), INSERT query (`WHERE received_at > $since AND endpoint_id = ANY($ids) ORDER BY received_at ASC LIMIT 100`), UPDATE query (`WHERE updated_at > $since AND received_at <= $since AND endpoint_id = ANY($ids) ORDER BY updated_at ASC LIMIT 100`), and return `{ inserts, updates, server_time: new Date().toISOString() }` — use the service-role Supabase client from `api/_lib/supabase.js`

- [x] T004 Create the transport composable core in `src/composables/use-realtime-transport.js` — implement as a module-level singleton (shared refs across all consumers, same pattern as `use-supabase.js` and `use-dashboard.js`). Expose: `transportMode` ref (initial value `'connecting'`), `isConnected` ref (initial `false`), `subscribe(name, config, callback)` function, `unsubscribe(name)` function. The `config` parameter shape: `{ table: string, events: string[], endpointIds: string[] }`. Store subscriptions in a module-level `Map<string, { config, callback, channel }>`. Capture `appLoadTime = new Date().toISOString()` at module load. In `subscribe()`: if mode is `'connecting'` or `'ws'`, create a Supabase Realtime channel via `useSupabase().client.channel(name)` with `.on('postgres_changes', ...)` for each event type in config, using filter `endpoint_id=in.(${config.endpointIds.join(',')})`. In the `.subscribe(status, err)` callback, call `handleChannelStatus(status)` (to be implemented in US1). On `'SUBSCRIBED'`, set `isConnected = true`. Return a cleanup function or handle via `unsubscribe()`. In `unsubscribe(name)`: remove channel via `client.removeChannel(channel)`, delete from subscriptions Map.

**Checkpoint**: Foundation ready — polling API is deployed, transport composable provides WebSocket subscriptions identical to current behavior

---

## Phase 3: User Story 1 - Transparent Fallback When WebSockets Are Blocked (Priority: P1) MVP

**Goal**: When WebSocket connections fail persistently, the system automatically switches to HTTP polling and the relay worker continues forwarding webhooks to localhost.

**Independent Test**: Block WebSocket connections via browser DevTools, send a webhook to an active endpoint, verify it appears in the relay and is forwarded to localhost within ~4 seconds.

### Implementation for User Story 1

- [x] T005 [US1] Add failure detection logic to the transport composable in `src/composables/use-realtime-transport.js` — implement `handleChannelStatus(status)`: on `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`, record the failure in a sliding window (module-level `failureCount` ref, `failureWindowStart` ref). If `failureCount >= 3` within 30 seconds of `failureWindowStart`, call `switchToPolling()`. On `SUBSCRIBED`, reset `failureCount = 0`, clear window, set `transportMode = 'ws'`, set `isConnected = true`. If a failure occurs more than 30s after `failureWindowStart`, reset the window and start a new count.

- [x] T006 [US1] Add polling mode to the transport composable in `src/composables/use-realtime-transport.js` — implement `switchToPolling()`: set `transportMode = 'poll'`, remove all existing Supabase channels (iterate subscriptions Map, call `client.removeChannel()` for each), then start a `setInterval` polling loop at 2000ms. In each poll tick: collect all unique `endpointIds` from subscriptions Map, skip if empty (FR-012). Call the polling API: `fetch('/api/poll?since=${encodeURIComponent(lastPollTime || appLoadTime)}&endpoint_ids=${ids.join(',')}', { headers: { Authorization: 'Bearer ' + session.access_token } })`. On success: update `lastPollTime = response.server_time`, set `isConnected = true`. Dispatch `inserts` to callbacks where subscription events includes `'INSERT'` and row's `endpoint_id` is in the subscription's `endpointIds`. Dispatch `updates` to callbacks where subscription events includes `'UPDATE'` and row's `endpoint_id` is in the subscription's `endpointIds`. On fetch error (network, 401, 500): set `isConnected = false`, log error, do NOT crash the interval — just skip this tick. On 401 specifically: consider triggering re-auth if the app has that flow. Store the interval ID in a module-level ref for cleanup.

- [x] T007 [US1] Add deduplication to the polling dispatch in `src/composables/use-realtime-transport.js` — maintain a module-level `seenIds` Set (max 100 entries per research R-004). Expose a `seedSeenIds(ids)` function that stores can call with IDs from their initial data load (to prevent re-dispatching events already fetched). Before dispatching any event (insert or update), check if `row.id` is in `seenIds`. If yes, skip. If no, add to `seenIds` and dispatch. When `seenIds.size > 100`, delete the oldest entry (convert to array, shift first, rebuild Set — or use a simple array-based ring buffer). Clear `seenIds` when switching transport modes.

- [x] T008 [US1] Add dynamic subscription updates to the transport composable in `src/composables/use-realtime-transport.js` — when `subscribe()` is called and mode is `'poll'`, do NOT create a Supabase channel — just register in the Map (the polling loop will pick up the new endpointIds on next tick). When `unsubscribe()` is called in poll mode, just remove from Map. Implement `updateSubscription(name, newConfig)` that updates the config in the Map (endpoint IDs may change). In WS mode, `updateSubscription` should tear down the old channel and create a new one with updated filters. This handles FR-013 (endpoint config changes).

- [x] T009 [US1] Refactor `src/stores/relay.js` to use the transport composable — replace direct `client.channel('relay-worker')` usage with `transport.subscribe('relay-worker', config, callback)`. Remove the internal `scheduleReconnect()` function, `reconnectAttempts` ref, and `reconnectTimer` ref (the transport composable handles all reconnection). In `startRelay()`: compute active endpoint IDs (same filter logic as today), call `transport.subscribe('relay-worker', { table: 'webhook_logs', events: ['INSERT'], endpointIds: activeIds }, (eventType, row) => { if (row.status === 'pending') forwardWebhook(row) })`. In `stopRelay()`: call `transport.unsubscribe('relay-worker')`. In `updateSubscription()`: call `transport.updateSubscription('relay-worker', { ...newConfig })` or do stop+start. Keep `relayStatus` ref but derive it from `transport.transportMode` and `transport.isConnected` — if transport is connected and relay has subscriptions, status is 'active'; if no endpoints, 'no-endpoints'; otherwise 'inactive'. Keep `forwardWebhook()` completely unchanged (it's transport-agnostic). Remove the channel status callback and `channel` ref since transport composable manages those. After initial data load, call `transport.seedSeenIds()` with the IDs of currently loaded logs to prevent duplicate dispatch on first poll.

- [x] T010 [US1] Update `src/components/relay/RelayWorker.vue` to pass transport state — the existing `watch` on `endpoints.endpoints` calls `relay.updateSubscription()`. Verify this still works correctly with the refactored relay store. The deep watch should trigger `updateSubscription` which now delegates to the transport composable. No template changes needed (still renders `display: none`).

**Checkpoint**: At this point, the relay worker functions via both WebSocket (normal) and HTTP polling (fallback). The core MVP is testable: block WebSocket → relay still works.

---

## Phase 4: User Story 4 - Consistent Live Updates Across All Views (Priority: P2)

**Goal**: In polling mode, the log list, log detail, and dashboard views all continue to show live updates (new entries, status transitions, activity feed).

**Independent Test**: In polling mode, trigger webhooks and verify: dashboard activity count increments, log list shows new entries without refresh, log status transitions from "pending" to "responded" update in place.

### Implementation for User Story 4

- [x] T011 [P] [US4] Refactor `src/stores/logs.js` to use the transport composable — replace direct `client.channel('log-viewer')` usage with `transport.subscribe('log-viewer', config, callback)`. In `startSubscription()`: compute endpoint IDs (either single endpoint from `endpointFilter` or all user endpoint IDs, same logic as today). Call `transport.subscribe('log-viewer', { table: 'webhook_logs', events: ['INSERT', 'UPDATE'], endpointIds: ids }, (eventType, row) => { ... })`. In the callback: for INSERT, replicate existing logic (increment totalCount, prepend to logs if on page 1 and passes filters, enrich with endpoint_name/slug). For UPDATE, replicate existing logic (find by id, merge). In `stopSubscription()`: call `transport.unsubscribe('log-viewer')`. Remove the `channel` ref and direct Supabase channel code. Remove the `console.log` status callback (transport composable handles status). After initial `fetchLogs()`, call `transport.seedSeenIds()` with the IDs of fetched logs to prevent duplicate dispatch on first poll.

- [x] T012 [P] [US4] Refactor `src/composables/use-dashboard.js` to use the transport composable — replace direct `client.channel('dashboard-activity')` usage with `transport.subscribe('dashboard-activity', config, callback)`. In `startSubscription()`: compute all user endpoint IDs (same logic as today). Call `transport.subscribe('dashboard-activity', { table: 'webhook_logs', events: ['INSERT', 'UPDATE'], endpointIds: ids }, (eventType, row) => { ... })`. In the callback: for INSERT, replicate existing logic (enrich with endpoint name/slug, prepend to recentLogs capped at 10, increment requestCount24h). For UPDATE, replicate existing logic (find by id in recentLogs, merge). In `stopSubscription()`: call `transport.unsubscribe('dashboard-activity')`. Remove the `channel` ref and direct Supabase channel code. After initial `fetchStats()`, call `transport.seedSeenIds()` with the IDs of fetched recent logs to prevent duplicate dispatch on first poll.

**Checkpoint**: All three real-time features (relay, logs, dashboard) now work via the unified transport composable in both WS and polling modes.

---

## Phase 5: User Story 2 - Automatic Recovery to WebSocket (Priority: P2)

**Goal**: While in polling mode, the system periodically probes WebSocket availability and automatically switches back when it becomes available.

**Independent Test**: Trigger polling mode by blocking WebSocket, then unblock it. Verify the system switches back to WebSocket mode within ~90 seconds and events arrive in real time again.

### Implementation for User Story 2

- [x] T013 [US2] Add WebSocket reconnect probe to the transport composable in `src/composables/use-realtime-transport.js` — when entering polling mode (`switchToPolling()`), start a 60-second `setInterval` for the reconnect probe. In each probe: create a test channel via `client.channel('transport-probe')` and subscribe. Set a 10-second timeout. If the test channel reaches `SUBSCRIBED` status within 10 seconds: clean up test channel (`client.removeChannel()`), clear the probe interval, clear the polling interval, call `switchToWebSocket()`. If the test channel fails or times out: clean up test channel, continue polling (probe interval fires again in 60s). Store the probe interval ID for cleanup.

- [x] T014 [US2] Implement `switchToWebSocket()` in `src/composables/use-realtime-transport.js` — stop the polling interval (clearInterval), clear `seenIds`. Set `transportMode = 'connecting'`. For each subscription in the Map: create a Supabase Realtime channel (same logic as initial `subscribe()` in WS mode), store the channel reference. The `.subscribe()` callback should use the same `handleChannelStatus()` which will set mode to `'ws'` on success. This ensures a seamless transition: polling stops, WS channels start, and if WS fails again, the failure detection kicks in and re-enters polling mode.

- [x] T015 [US2] Handle cleanup on `unsubscribe()` and component unmount in `src/composables/use-realtime-transport.js` — ensure that when all subscriptions are removed (Map becomes empty), both the polling interval and probe interval are cleared. Add a `destroy()` function that clears all intervals, removes all channels, and resets state. This prevents leaked timers if the user logs out or navigates away.

**Checkpoint**: The system now auto-recovers to WebSocket mode. Full cycle: WS → detect failure → poll → probe WS → recover → WS.

---

## Phase 6: User Story 3 - Transport Mode Visibility (Priority: P3)

**Goal**: The relay status indicator shows the current transport mode so users can understand connection behavior at a glance.

**Independent Test**: Observe the relay status area in WebSocket mode (green "Live"), during initial connection (gray "Connecting..."), and in polling mode (amber "Polling"). Verify correct indicator and tooltip in each state.

### Implementation for User Story 3

- [x] T016 [US3] Update `src/components/relay/RelayStatus.vue` to display transport mode indicator — import `useRealtimeTransport` composable. Add a transport mode badge next to the existing relay status pill. Three states: (1) `transportMode === 'connecting'`: gray/blue dot with "Connecting..." text, no tooltip. (2) `transportMode === 'ws'`: green dot with "Live" text (integrates with existing green "Connected" state). (3) `transportMode === 'poll'`: amber dot with "Polling (2s)" text, add a PrimeVue Tooltip (`v-tooltip`) with text "WebSocket unavailable. Using HTTP polling as fallback. Updates may be slightly delayed." Use Tailwind classes for dot colors: `bg-gray-400` (connecting), `bg-green-500` with `animate-pulse` (live/ws), `bg-amber-500` (polling). Keep the existing Skeleton loading state while `endpoints.initialLoaded` is false. The transport indicator should appear alongside (not replace) the existing relay status text.

**Checkpoint**: Users can now see at a glance whether they're on Live (WebSocket) or Polling (fallback) mode.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling, error resilience, and cleanup

- [x] T017 Add error handling for 401 responses in polling mode in `src/composables/use-realtime-transport.js` — when the polling API returns 401, attempt to refresh the Supabase session via `client.auth.getSession()`. If the session is still valid (token refreshed), retry the poll. If the session is invalid, set `isConnected = false` and stop polling (user needs to re-authenticate). Do not crash the polling loop.

- [x] T018 Add `no-endpoints` handling to the transport composable in `src/composables/use-realtime-transport.js` — when `subscribe()` is called with empty `endpointIds`, or when all subscriptions have empty endpointIds, do not start polling and do not create WS channels. Set a state that the relay store can read to show 'no-endpoints' status. When endpoints are later added via `subscribe()` or `updateSubscription()`, start the appropriate transport.

- [x] T019 [P] Verify existing Vercel rewrite rules in `vercel.json` do not interfere with the new `/api/poll` endpoint — the SPA catch-all rewrite `/((?!api/).*)` → `/index.html` excludes `/api/` routes, so `/api/poll/index.js` should be served correctly. No changes expected, but verify by testing the endpoint after deployment.

- [x] T020 Run the application end-to-end and verify: (1) Normal WebSocket mode works as before (no regression), (2) Blocking WebSocket triggers polling fallback within ~15s, (3) Relay forwards webhooks in polling mode, (4) Log list and dashboard update in polling mode, (5) Unblocking WebSocket recovers to WS mode within ~90s, (6) Transport indicator shows correct state in all modes, (7) No console errors or leaked intervals on page navigation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration must be applied before polling API can query updated_at)
- **US1 (Phase 3)**: Depends on Phase 2 (needs transport composable core + polling API)
- **US4 (Phase 4)**: Depends on Phase 3 (transport composable must have polling mode working)
- **US2 (Phase 5)**: Depends on Phase 3 (reconnect probe only makes sense after polling mode exists)
- **US3 (Phase 6)**: Depends on Phase 2 (needs transportMode ref to exist); can run in parallel with US1/US4/US2
- **Polish (Phase 7)**: Depends on Phases 3-6

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — no other story dependencies. This is the MVP.
- **US4 (P2)**: Depends on US1 (transport composable polling mode must work before refactoring logs/dashboard stores)
- **US2 (P2)**: Depends on US1 (reconnect probe only relevant after polling mode exists). Independent of US4.
- **US3 (P3)**: Depends only on Foundational (reads `transportMode` ref). Can run in parallel with US1/US4/US2.

### Within Each User Story

- Core logic before store refactoring
- Store refactoring before UI changes
- Edge cases after happy path

### Parallel Opportunities

- T011 and T012 (US4) can run in parallel (different files: logs.js vs use-dashboard.js)
- T017 and T018 and T019 (Polish) can all run in parallel
- US2 and US3 can run in parallel after US1 is complete
- US3 can technically start as early as Phase 2 completion (only needs transportMode ref)

---

## Parallel Example: User Story 4

```bash
# These two tasks modify different files and can run simultaneously:
Task T011: "Refactor src/stores/logs.js to use transport composable"
Task T012: "Refactor src/composables/use-dashboard.js to use transport composable"
```

## Parallel Example: Polish Phase

```bash
# These three tasks are independent:
Task T017: "Add 401 error handling in transport composable"
Task T018: "Add no-endpoints handling in transport composable"
Task T019: "Verify Vercel rewrite rules for /api/poll"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration)
2. Complete Phase 2: Foundational (polling API + transport composable core)
3. Complete Phase 3: User Story 1 (failure detection, polling mode, relay refactor)
4. **STOP and VALIDATE**: Block WebSocket in browser, send a webhook, verify relay works via polling
5. Deploy if ready — the relay is the critical path

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Relay works in polling mode → Deploy (MVP!)
3. Add US4 → Logs + dashboard also update in polling mode → Deploy
4. Add US2 → Auto-recovery to WebSocket → Deploy
5. Add US3 → Transport mode indicator visible → Deploy
6. Polish → Edge cases, error handling, cleanup → Deploy

### Notes

- US3 (UI indicator) is low-risk and can be implemented at any point after Phase 2
- US2 (reconnect probe) is an optimization — the app works fine without it, just stays in polling mode
- The MVP (US1) delivers the core value: relay works even when WebSocket is blocked
