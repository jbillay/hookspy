# Tasks: Browser Relay Engine

**Input**: Design documents from `/specs/006-browser-relay/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration for browser-side webhook claiming

- [x] T001 Create RLS UPDATE policy migration for webhook_logs allowing authenticated users to update status on their own logs in supabase/migrations/20260212000001_relay_rls_policy.sql — Policy: `endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Relay store scaffold and composable that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create relay store scaffold in src/stores/relay.js — Define state refs: `relayStatus` ('inactive'|'active'|'no-endpoints'), `forwardingCount` (0), `lastError` (null), `channel` (null). Add `FORBIDDEN_HEADERS` constant (Host, Origin, Cookie, Content-Length, Connection, Keep-Alive, Accept-Charset, Accept-Encoding, Transfer-Encoding, TE, Trailer, Upgrade, Via, Date, DNT, Expect, Referer, Cookie2, Set-Cookie, Access-Control-Request-Headers, Access-Control-Request-Method, plus Proxy-_ and Sec-_ prefixes). Add `buildTargetUrl(endpoint)` helper that returns `{target_url}:{target_port}{target_path}`. Add `filterHeaders(headers)` helper that removes forbidden headers. Export store using `defineStore('relay', () => {...})` pattern.
- [x] T003 [P] Create relay composable wrapper in src/composables/use-relay.js — Thin wrapper: `export function useRelay() { return useRelayStore() }`. Follow existing pattern from use-auth.js.

**Checkpoint**: Foundation ready — store scaffold and composable exist, RLS policy deployed

---

## Phase 3: User Story 1 + 2 — Forward Webhooks and Relay Responses (Priority: P1) MVP

**Goal**: When a webhook arrives, the browser claims it, forwards it to localhost, captures the local server's response, and submits it back to the HookSpy API for relay to the original sender.

**Independent Test**: Open dashboard, send a webhook via curl to endpoint URL, verify local server receives the forwarded request AND the curl command receives the local server's response.

### Implementation for User Story 1 + 2

- [x] T004 [US1] Implement startRelay() action in src/stores/relay.js — Get active endpoints from useEndpointsStore(). If none active, set relayStatus to 'no-endpoints' and return. Build filter string `endpoint_id=in.(${ids.join(',')})`. Create Supabase Realtime channel named 'relay-worker' subscribing to postgres_changes INSERT on webhook_logs table with the endpoint filter. On SUBSCRIBED status, set relayStatus to 'active'. On CHANNEL_ERROR/TIMED_OUT/CLOSED, set relayStatus to 'inactive'. On new INSERT payload, call forwardWebhook(payload.new). Use useSupabase() composable for client access.
- [x] T005 [US1] Implement stopRelay() and updateSubscription() actions in src/stores/relay.js — stopRelay(): if channel exists, call supabase.removeChannel(channel), set channel to null, set relayStatus to 'inactive'. updateSubscription(): call stopRelay() then startRelay() to re-subscribe with current active endpoint IDs. This is called when endpoints change.
- [x] T006 [US1] Implement forwardWebhook() action — claim and forward — in src/stores/relay.js — Accept webhook log object. Step 1: Claim webhook via conditional Supabase update: `supabase.from('webhook_logs').update({status:'forwarding'}).eq('id',log.id).eq('status','pending').select()`. If data is empty array, another tab claimed it — return early. Step 2: Look up endpoint config from endpoints store via `getEndpoint(log.endpoint_id)`. Step 3: Build target URL with buildTargetUrl(). Step 4: Filter request_headers with filterHeaders(), merge endpoint.custom_headers (custom takes precedence). Step 5: Execute fetch with method=log.request_method, merged headers, body (undefined for GET/HEAD), mode='cors'. Increment forwardingCount before fetch, decrement in finally block.
- [x] T007 [US2] Complete forwardWebhook() — capture response and submit — in src/stores/relay.js — After successful fetch: capture response.status, Object.fromEntries(response.headers.entries()) as headers, await response.text() as body. POST to `/api/logs/${log.id}/response` with auth headers from useAuthStore() session.access_token, sending JSON `{status, headers, body}`. Handle 409 (already resolved) silently. Set lastError to null on success.
- [x] T008 [US1] Create RelayWorker.vue component in src/components/relay/RelayWorker.vue — Invisible component (template: empty div or template with no content). In `<script setup>`: import useRelay and useEndpoints composables. On onMounted: call relay.startRelay(). On onUnmounted: call relay.stopRelay(). Watch endpoints.endpoints array (deep) — when it changes, call relay.updateSubscription(). No visible UI.
- [x] T009 [US1] Mount RelayWorker in AppLayout.vue in src/components/layout/AppLayout.vue — Import RelayWorker component. Add `<RelayWorker />` inside the authenticated section (next to AppHeader, inside the `v-if="isAuthenticated && !isGuestRoute"` block). RelayWorker should render alongside existing content, not replace it.

**Checkpoint**: User Stories 1 + 2 are functional — webhooks are forwarded to localhost and responses are relayed back. Test by sending curl to endpoint URL with a local server running.

---

## Phase 4: User Story 3 — Error Handling (Priority: P1)

**Goal**: When the browser cannot reach the local server (CORS, connection refused, network error), it reports the error to the API with a descriptive message.

**Independent Test**: Stop the local server, send a webhook, verify the webhook log shows an error status with a descriptive message. The curl command should receive a 502 response.

### Implementation for User Story 3

- [x] T010 [US3] Implement error classification in forwardWebhook() catch block in src/stores/relay.js — Wrap the fetch call in try/catch. In the catch block, classify errors: if error is TypeError and message includes 'Failed to fetch' or 'NetworkError', check if it's likely CORS (opaque response) → message: `CORS error: {url} — Enable CORS on your local server`. If connection refused pattern → message: `Connection refused: {url}`. Otherwise → message: `Network error: {error.message}`. Set lastError to the classified message.
- [x] T011 [US3] Implement error reporting to API in forwardWebhook() catch block in src/stores/relay.js — After classifying the error, POST to `/api/logs/${log.id}/response` with auth headers, sending JSON `{error: classifiedMessage}`. Handle network errors during error reporting gracefully (console.error only, don't throw). Decrement forwardingCount in finally block (should already be there from T006).

**Checkpoint**: User Story 3 is functional — errors are classified, reported to the API, and visible in webhook logs. Test by stopping local server and sending a webhook.

---

## Phase 5: User Story 4 — Relay Status Indicator (Priority: P2)

**Goal**: The dashboard header shows a colored dot indicating relay connection state: green (Active), red (Inactive), amber (No Active Endpoints).

**Independent Test**: Open dashboard and verify green dot appears. Delete all endpoints and verify amber dot. Disconnect network and verify red dot.

### Implementation for User Story 4

- [x] T012 [US4] Create RelayStatus.vue component in src/components/relay/RelayStatus.vue — Import useRelay composable. Display a small colored dot (8px circle) with text label. Computed class based on relay.relayStatus: 'active' → green bg + "Relay Active", 'inactive' → red bg + "Relay Inactive", 'no-endpoints' → amber bg + "No Active Endpoints". Use Tailwind classes: `w-2 h-2 rounded-full` for dot, `bg-green-500`, `bg-red-500`, `bg-amber-500` for colors. Wrap in flex container with gap-2 and text-sm.
- [x] T013 [US4] Add RelayStatus to AppHeader.vue in src/components/layout/AppHeader.vue — Import RelayStatus component. Place it in the header bar between the navigation links and the user email/logout section. Render only when authenticated (it's already inside the auth-conditional header).
- [x] T014 [US4] Implement reconnection with exponential backoff in src/stores/relay.js — Add `reconnectAttempts` ref (0) and `reconnectTimer` ref (null). In the channel subscribe callback, when status is CHANNEL_ERROR or CLOSED: set relayStatus to 'inactive', calculate delay as `Math.min(1000 * 2 ** reconnectAttempts, 30000)`, set a setTimeout to call stopRelay() then startRelay(), increment reconnectAttempts. On SUBSCRIBED: reset reconnectAttempts to 0 and clear reconnectTimer. In stopRelay(): clear reconnectTimer if set.

**Checkpoint**: User Story 4 is functional — status indicator reflects connection state accurately and reconnects automatically.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tests, quality checks, and validation

- [x] T015 [P] Write unit tests for relay store in tests/unit/stores/relay.test.js — Test: buildTargetUrl() with various endpoint configs. Test: filterHeaders() removes forbidden headers and keeps safe ones. Test: forwardWebhook() claims webhook via conditional update. Test: forwardWebhook() skips already-claimed webhooks (empty data array). Test: startRelay() sets status to 'no-endpoints' when no active endpoints. Test: startRelay() creates channel with correct filter. Test: error classification produces correct messages. Mock supabase client and fetch API.
- [x] T016 [P] Write unit tests for relay composable in tests/unit/composables/use-relay.test.js — Test: useRelay() returns the relay store instance. Test: returned object has expected properties (relayStatus, forwardingCount, lastError, startRelay, stopRelay, etc.). Follow existing test pattern from use-auth.test.js.
- [x] T017 Run lint, format, and build checks — Execute `npm run lint:fix && npm run format && npm run build` to ensure all new code passes quality gates.
- [x] T018 Run quickstart.md validation steps — Follow the verification steps in specs/006-browser-relay/quickstart.md to manually validate the full relay flow end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (RLS policy must exist before relay can claim webhooks)
- **US1+US2 (Phase 3)**: Depends on Phase 2 (store scaffold must exist)
- **US3 (Phase 4)**: Depends on Phase 3 (error handling wraps the forwarding logic)
- **US4 (Phase 5)**: Depends on Phase 2 only (can parallel with Phase 3/4 since it reads relayStatus)
- **Polish (Phase 6)**: Depends on Phases 3, 4, 5

### User Story Dependencies

- **US1+US2 (P1)**: Depends on Foundational — core relay flow
- **US3 (P1)**: Depends on US1+US2 — adds error handling to existing forwardWebhook()
- **US4 (P2)**: Depends on Foundational only — reads relayStatus ref, can run in parallel with US1+US2

### Within Each Phase

- T004 → T005 → T006 → T007 (sequential: subscription → lifecycle → forwarding → component)
- T007 depends on T006 (RelayWorker calls forwardWebhook via startRelay)
- T008 → T009 (mount component, then add watcher)
- T010 → T011 (classify errors, then report them)
- T012 → T013 (create component, then mount in header)

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T015 and T016 can run in parallel (different test files)
- Phase 5 (US4) can run in parallel with Phase 3+4 (US1+US2+US3) — they touch different files

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These can run in parallel (different files):
Task: "Create relay store scaffold in src/stores/relay.js"
Task: "Create relay composable wrapper in src/composables/use-relay.js"
```

## Parallel Example: Phase 5 + Phase 3

```bash
# US4 can start alongside US1+US2 after Phase 2 completes:
Task: "Create RelayStatus.vue in src/components/relay/RelayStatus.vue"  # US4
Task: "Implement startRelay() in src/stores/relay.js"                    # US1
```

## Parallel Example: Phase 6 (Tests)

```bash
# Test files can run in parallel:
Task: "Write unit tests for relay store in tests/unit/stores/relay.test.js"
Task: "Write unit tests for composable in tests/unit/composables/use-relay.test.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (RLS migration)
2. Complete Phase 2: Foundational (store scaffold + composable)
3. Complete Phase 3: US1+US2 (forwarding + response relay)
4. **STOP and VALIDATE**: Send a webhook, verify it reaches localhost and the response comes back
5. Deploy/demo if ready — basic relay is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1+US2 → Forward and relay webhooks → MVP!
3. US3 → Add error handling → Robust relay
4. US4 → Add status indicator → Complete UX
5. Polish → Tests + validation → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 share the same phase because forwarding and response relay happen in the same function flow
- US3 extends the forwardWebhook() function with error handling — must follow US1+US2
- US4 can run in parallel with US1+US2+US3 since it only reads relayStatus state
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
