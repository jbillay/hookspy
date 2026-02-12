# Tasks: Log Viewer

**Input**: Design documents from `/specs/007-log-viewer/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (API Layer)

**Purpose**: Create serverless API endpoints for log data access

- [x] T001 [P] Create GET /api/logs endpoint in api/logs/index.js — Handle GET requests only (405 for others). Verify auth via `verifyAuth(req)`. Parse query params: `endpoint_id` (optional uuid), `page` (default 1), `limit` (default 50, max 100). Build Supabase query: `supabase.from('webhook_logs').select('*, endpoints!inner(name, slug, user_id)', { count: 'exact' })`. Filter by `endpoints.user_id = user.id`. If `endpoint_id` provided, add `.eq('endpoint_id', endpoint_id)`. Order by `received_at DESC`. Apply pagination: `.range((page-1)*limit, page*limit-1)`. Map results to include `endpoint_name` and `endpoint_slug` from the join. Return `{ data, total: count }`. Handle CORS via shared helpers.
- [x] T002 [P] Create GET /api/logs/:id endpoint in api/logs/[id].js — Handle GET only (405 for others). Verify auth. Query: `supabase.from('webhook_logs').select('*, endpoints!inner(name, slug, user_id)').eq('id', id).single()`. Verify `data.endpoints.user_id === user.id` (404 if not). Map result to include `endpoint_name` and `endpoint_slug`. Return `{ data }`. Handle CORS.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Store scaffold, composable, and shared PayloadViewer component that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create logs Pinia store scaffold in src/stores/logs.js — Define state refs: `logs` ([]), `loading` (false), `error` (null), `totalCount` (0), `currentPage` (1), `pageSize` (50), `endpointFilter` (null), `channel` (null). Add `getAuthHeaders()` helper using `useAuthStore().session.access_token` (follow pattern from endpoints store). Implement `fetchLogs()`: set loading=true, fetch `GET /api/logs?endpoint_id=X&page=Y&limit=Z` with auth headers, set `logs.value = json.data`, `totalCount.value = json.total`, handle errors, set loading=false in finally. Implement `setEndpointFilter(id)`: set endpointFilter, reset currentPage to 1, call fetchLogs(). Implement `setPage(page)`: set currentPage, call fetchLogs(). Export store using `defineStore('logs', () => {...})`.
- [x] T004 [P] Create logs composable in src/composables/use-logs.js — Thin wrapper: `export function useLogs() { return useLogsStore() }`. Import from `../stores/logs.js`. Follow pattern from use-auth.js.
- [x] T005 [P] Create PayloadViewer component in src/components/logs/PayloadViewer.vue — Props: `content` (String, default ''), `contentType` (String, default 'text'). Computed `isJson`: try `JSON.parse(content)`, return true/false. Ref `showRaw` (false), ref `showFull` (false). Computed `isTruncated`: `content && content.length > 102400`. Computed `displayContent`: if isTruncated and !showFull, slice to 102400 chars; else full content. Computed `prettyJson`: if isJson and !showRaw, `JSON.stringify(JSON.parse(content), null, 2)`. Template: if no content, show "No body" in muted text. If content exists: toggle buttons "Pretty"/"Raw" (only when isJson, use PrimeVue Button with `text` severity). Display area: if isJson and !showRaw, render pretty JSON with CSS syntax highlighting (apply classes to keys, strings, numbers, booleans, null via a `highlightJson(str)` function that wraps tokens in spans). If showRaw or !isJson, render in `<pre>` with monospace. If isTruncated, show "Show full body" / "Collapse" toggle button below.

**Checkpoint**: Foundation ready — store, composable, and PayloadViewer exist

---

## Phase 3: User Story 1 + 2 — Real-Time Log List with Expandable Detail (Priority: P1) MVP

**Goal**: Display a live-updating log list for a specific endpoint with expandable inline rows showing full request/response details side by side.

**Independent Test**: Navigate to an endpoint's detail page, trigger a webhook via curl, verify the log appears within 1 second. Click to expand and verify request/response details with JSON highlighting.

### Implementation for User Story 1 + 2

- [x] T006 [US1] Implement Realtime subscription in src/stores/logs.js — Add `startSubscription()`: get user's endpoint IDs from `useEndpointsStore().endpoints`. If `endpointFilter` is set, filter to just that ID. Build filter string `endpoint_id=in.(${ids.join(',')})`. Create Supabase channel 'log-viewer' subscribing to `postgres_changes` on `webhook_logs` for both INSERT and UPDATE events with the endpoint filter. On INSERT: if `currentPage === 1`, prepend `payload.new` to `logs` array and increment `totalCount`. On UPDATE: find log by `payload.new.id` in `logs` array, merge updated fields (status, response_status, response_headers, response_body, error_message, responded_at, duration_ms). Store channel ref. Add `stopSubscription()`: if channel exists, call `supabase.removeChannel(channel)`, set channel to null. Use `useSupabase()` composable for client access.
- [x] T007 [P] [US2] Create LogDetail component in src/components/logs/LogDetail.vue — Props: `log` (Object, required). Template: two-column grid layout (Tailwind `grid grid-cols-2 gap-4 p-4`). Left column "Request": show HTTP method as Tag badge (severity based on method: GET=info, POST=success, PUT=warn, DELETE=danger), request URL, "Headers" label with key-value list from `log.request_headers` (iterate Object.entries, display in `<dl>` or simple div pairs), PayloadViewer for `log.request_body`. Right column "Response": if status is `responded`, show response status code as Tag (2xx=success, 4xx=warn, 5xx=danger), response headers key-value list, PayloadViewer for `log.response_body`. If status is `timeout`, show "No response — timed out" with timeout duration. If status is `error`, show error_message with amber info box. If status is `pending` or `forwarding`, show "Waiting for response..." text. Header bar above columns: show `received_at` formatted timestamp and duration (formatDuration helper: <1000 → "{n}ms", >=1000 → "{n.n}s", null → "—").
- [x] T008 [US1] Create LogList component in src/components/logs/LogList.vue — Props: `endpointId` (String, optional). Import PrimeVue DataTable, Column, Tag, Paginator. Import LogDetail. Ref `expandedRows` ({}). On mounted: if endpointId prop, call `store.setEndpointFilter(endpointId)` then `store.startSubscription()`. On unmounted: call `store.stopSubscription()`. Template: DataTable with `v-model:expandedRows="expandedRows"` and `dataKey="id"`. Columns: expander column (width 3rem), received_at (formatted with toLocaleString, header "Time"), request_method (Tag badge, header "Method"), request_url (truncated with ellipsis, header "URL"), status (Tag with severity computed from status — pending/forwarding=info, responded=success, timeout=warn, error=danger; forwarding gets additional CSS pulsing animation class, header "Status"), duration_ms (formatted with formatDuration helper, header "Duration"). Expansion template `#expansion="slotProps"`: render `<LogDetail :log="slotProps.data" />`. Paginator below table: use PrimeVue Paginator with `:rows="store.pageSize"` `:totalRecords="store.totalCount"` `:first="(store.currentPage-1)*store.pageSize"` `@page="onPageChange"`. Empty state: if !store.loading and logs empty, show "No webhook logs yet" message. Loading state: show ProgressSpinner when store.loading.
- [x] T009 [US1] Integrate LogList into EndpointDetailView in src/views/EndpointDetailView.vue — Import LogList component. In edit mode (not create), add a section below the endpoint form with heading "Webhook Logs". Render `<LogList :endpointId="route.params.id" />` in that section. Add a visual separator (border or spacing) between the endpoint form and logs section.
- [x] T010 [US1] Add "Logs" navigation link to AppHeader in src/components/layout/AppHeader.vue — Add a new router-link to `/logs` in the nav section next to the existing "Endpoints" link. Label: "Logs". Same styling as existing nav links: `text-sm text-surface-600 hover:text-primary no-underline`.

**Checkpoint**: User Stories 1 + 2 are functional — log list shows per-endpoint logs in real time with expandable detail rows. Test by navigating to an endpoint detail page and sending a webhook.

---

## Phase 4: User Story 3 — Combined Log View (Priority: P2)

**Goal**: Display a combined log feed from all endpoints with endpoint name visible on each entry.

**Independent Test**: Navigate to /logs and verify logs from multiple endpoints appear with endpoint names.

### Implementation for User Story 3

- [x] T011 [US3] Create LogsView in src/views/LogsView.vue — Import LogList component. Template: page container with heading "All Logs" (text-2xl font-bold). Render `<LogList />` without endpointId prop (shows all endpoints). The LogList component already handles the no-filter case via the store's fetchLogs (endpoint_id param omitted).
- [x] T012 [US3] Update LogList to show endpoint name column in src/components/logs/LogList.vue — Add a computed `showEndpointColumn` that is true when `endpointId` prop is not provided (combined view). Conditionally render an "Endpoint" Column between "Time" and "Method" columns when `showEndpointColumn` is true. Display `endpoint_name` from the log data (joined by the API). Use a Tag or plain text badge.
- [x] T013 [US3] Add /logs route to router in src/router/index.js — Add route: `{ path: '/logs', name: 'logs', component: () => import('../views/LogsView.vue') }`. Place it after the dashboard route. It should be protected by the existing auth guard (non-guest route).
- [x] T014 [US3] Update LogList Realtime for all-endpoints mode in src/components/logs/LogList.vue — When `endpointId` prop is not provided: on mounted, call `store.setEndpointFilter(null)` then `store.fetchLogs()` then `store.startSubscription()`. The store's `startSubscription()` already handles the all-endpoints case by using all endpoint IDs from the endpoints store when `endpointFilter` is null.

**Checkpoint**: User Story 3 is functional — combined log view shows all logs with endpoint names. Test by navigating to /logs.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Tests, quality checks, and validation

- [x] T015 [P] Write unit tests for logs store in tests/unit/stores/logs.test.js — Test: initial state values are correct. Test: fetchLogs() calls API with correct params and updates state. Test: fetchLogs() with endpointFilter includes endpoint_id param. Test: setPage() updates currentPage and calls fetchLogs. Test: setEndpointFilter() updates filter, resets page, calls fetchLogs. Test: startSubscription() creates Realtime channel. Test: stopSubscription() removes channel. Test: INSERT event handler prepends to logs on page 1. Test: UPDATE event handler merges fields for matching log. Mock fetch API and supabase client.
- [x] T016 [P] Write unit tests for use-logs composable in tests/unit/composables/use-logs.test.js — Test: useLogs() returns the logs store instance. Test: returned object has expected properties (logs, loading, error, totalCount, fetchLogs, setPage, etc.). Follow existing test pattern from use-auth.test.js.
- [x] T017 [P] Write unit tests for PayloadViewer in tests/unit/components/PayloadViewer.test.js — Test: renders "No body" when content is empty. Test: renders raw text for non-JSON content. Test: detects and pretty-prints JSON. Test: toggle switches between Pretty and Raw views. Test: truncates content over 102400 chars. Test: "Show full body" toggle reveals full content. Use @vue/test-utils mount.
- [x] T018 Run lint, format, and build checks — Execute `npm run lint:fix && npm run format && npm run build` to ensure all new code passes quality gates.
- [x] T019 Run quickstart.md validation steps — Follow the verification steps in specs/007-log-viewer/quickstart.md to validate the full log viewer flow end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Can run in parallel with Phase 1 (T003 depends on API being available for runtime, but can be coded first)
- **US1+US2 (Phase 3)**: Depends on Phase 1 (API endpoints) and Phase 2 (store + PayloadViewer)
- **US3 (Phase 4)**: Depends on Phase 3 (reuses LogList component)
- **Polish (Phase 5)**: Depends on Phases 3 and 4

### User Story Dependencies

- **US1+US2 (P1)**: Depends on Foundational — core log list and detail expansion
- **US3 (P2)**: Depends on US1+US2 — reuses LogList component with additional endpoint column

### Within Each Phase

- T001 and T002 can run in parallel (different files)
- T003 → T006 (store scaffold before Realtime subscription)
- T004 and T005 can run in parallel with T003 (different files)
- T007 can run in parallel with T006 (LogDetail is a different file from store)
- T008 depends on T006 and T007 (LogList uses store + LogDetail)
- T009 depends on T008 (needs LogList to exist)
- T011 → T012 → T014 (view, then add column, then fix subscription mode)
- T015, T016, T017 can run in parallel (different test files)

### Parallel Opportunities

- T001 and T002 can run in parallel (different API files)
- T003, T004, and T005 can run in parallel (different files)
- T006 and T007 can run in parallel (store vs component)
- T015, T016, and T017 can run in parallel (different test files)

---

## Parallel Example: Phase 1 (Setup)

```bash
# These can run in parallel (different files):
Task: "Create GET /api/logs endpoint in api/logs/index.js"
Task: "Create GET /api/logs/:id endpoint in api/logs/[id].js"
```

## Parallel Example: Phase 2 (Foundational)

```bash
# Store scaffold and PayloadViewer can run in parallel:
Task: "Create logs Pinia store scaffold in src/stores/logs.js"
Task: "Create PayloadViewer component in src/components/logs/PayloadViewer.vue"
Task: "Create logs composable in src/composables/use-logs.js"
```

## Parallel Example: Phase 5 (Tests)

```bash
# Test files can run in parallel:
Task: "Write unit tests for logs store in tests/unit/stores/logs.test.js"
Task: "Write unit tests for use-logs composable in tests/unit/composables/use-logs.test.js"
Task: "Write unit tests for PayloadViewer in tests/unit/components/PayloadViewer.test.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (API endpoints)
2. Complete Phase 2: Foundational (store + composable + PayloadViewer)
3. Complete Phase 3: US1+US2 (log list + expandable detail)
4. **STOP and VALIDATE**: Navigate to endpoint detail, send a webhook, verify log appears and expands with details
5. Deploy/demo if ready — basic log viewer is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1+US2 → Real-time log list with expandable detail → MVP!
3. US3 → Combined "All Logs" view → Complete feature
4. Polish → Tests + validation → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 share the same phase because the expandable row detail (US2) is an integral part of the DataTable (US1) — they can't be meaningfully separated
- US3 builds on the LogList component from US1+US2, adding an endpoint column and a new route
- No database migrations needed — existing webhook_logs table has all required columns
- PayloadViewer is in Foundational because both US1+US2 (body display) and US3 (same) depend on it
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
