# Tasks: Replay & Search

**Input**: Design documents from `/specs/008-replay-search/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database + API)

**Purpose**: Database migration and API endpoints that all user stories depend on

- [x] T001 [P] Create migration for replayed_from column in supabase/migrations/20260212000001_add_replayed_from.sql — Add `replayed_from` column to `webhook_logs` table: `ALTER TABLE webhook_logs ADD COLUMN replayed_from uuid REFERENCES webhook_logs(id) ON DELETE SET NULL;`. Column is nullable (null = original webhook, non-null = replay). ON DELETE SET NULL so replays survive cleanup of the original log.
- [x] T002 [P] Create POST /api/logs/:id/replay endpoint in api/logs/[id]/replay.js — Handle POST only (405 for others). Verify auth via `verifyAuth(req)`. Extract `id` from `req.query`. Fetch original log: `supabase.from('webhook_logs').select('*, endpoints!inner(name, slug, user_id)').eq('id', id).single()`. If not found or `endpoints.user_id !== user.id`, return 404. Check endpoint still exists: `supabase.from('endpoints').select('id').eq('id', log.endpoint_id).single()` — if not found, return 404 with `"Endpoint no longer exists"`. Insert new log: `supabase.from('webhook_logs').insert({ endpoint_id: log.endpoint_id, status: 'pending', request_method: log.request_method, request_url: log.request_url, request_headers: log.request_headers, request_body: log.request_body, replayed_from: log.id }).select().single()`. Return 201 with `{ data: newLog }`. Handle CORS via shared helpers.
- [x] T003 [P] Extend GET /api/logs endpoint in api/logs/index.js — Add new query params: `method`, `status`, `from`, `to`, `q`. Parse `method` and `status` as comma-separated strings into arrays. If `method` provided, add `.in('request_method', methods)`. If `status` provided, add `.in('status', statuses)`. If `from` provided, add `.gte('received_at', from)`. If `to` provided, add `.lte('received_at', to)`. If `q` provided, add `.or('request_body.ilike.%${q}%,request_url.ilike.%${q}%,response_body.ilike.%${q}%,error_message.ilike.%${q}%')`. Ensure `replayed_from` is included in the select (already covered by `*`). All new filters are AND-ed with existing endpoint_id filter. Existing pagination and CORS behavior unchanged.

**Checkpoint**: API layer ready — replay endpoint and extended filters available

---

## Phase 2: Foundational (Store Extensions)

**Purpose**: Extend the logs Pinia store with filter state and replay action

**CRITICAL**: No UI work can begin until this phase is complete

- [x] T004 Extend logs store with filter state and actions in src/stores/logs.js — Add new state refs: `methodFilter` (ref([])), `statusFilter` (ref([])), `searchQuery` (ref('')), `dateFrom` (ref(null)), `dateTo` (ref(null)). Add computed `hasActiveFilters`: true if any filter is non-default (methodFilter.length > 0 || statusFilter.length > 0 || searchQuery !== '' || dateFrom !== null || dateTo !== null). Update `fetchLogs()`: add `methodFilter` → `method` param (join with comma), `statusFilter` → `status` param (join with comma), `dateFrom` → `from` param (toISOString), `dateTo` → `to` param (toISOString), `searchQuery` → `q` param. Add new actions: `setMethodFilter(methods)` — set methodFilter, reset currentPage to 1, call fetchLogs(). `setStatusFilter(statuses)` — set statusFilter, reset currentPage to 1, call fetchLogs(). `setSearchQuery(query)` — set searchQuery, reset currentPage to 1, call fetchLogs(). `setDateRange(from, to)` — set dateFrom and dateTo, reset currentPage to 1, call fetchLogs(). `clearAllFilters()` — reset all filter refs to defaults, reset currentPage to 1, call fetchLogs(). Add `replayLog(logId)` action: POST to `/api/logs/${logId}/replay` with auth headers, return `{ data }` on success or `{ error }` on failure. Add `matchesFilters(log)` helper (not exported, used by Realtime handler): check if a log matches current methodFilter (if set, log.request_method must be in array), statusFilter (if set, log.status must be in array), searchQuery (if set, case-insensitive substring match on request_body, request_url, response_body, error_message). Update Realtime INSERT handler: only prepend log to list if `matchesFilters(log)` returns true (always increment totalCount regardless). Export all new refs, computed, and actions.

**Checkpoint**: Foundation ready — store has filter state, filter actions, replay action, and filter-aware Realtime

---

## Phase 3: User Story 1 — Replay Webhook (Priority: P1) MVP

**Goal**: Users can replay any completed webhook, creating a new log entry forwarded by the browser relay.

**Independent Test**: View a log with terminal status, click Replay, verify new log appears with "Replay" badge and gets forwarded.

### Implementation for User Story 1

- [x] T005 [US1] Add replay button and replay badge to LogDetail in src/components/logs/LogDetail.vue — Import PrimeVue Button. Import `useLogs` composable. Add `replayLog` method: call `store.replayLog(props.log.id)`, show success toast on success ("Webhook replayed"), error toast on failure. In the header bar area (above the two columns), add a "Replay" Button: `<Button label="Replay" icon="pi pi-replay" severity="secondary" text size="small" @click="replayLog" :disabled="replayLoading" />`. Only show when log status is terminal (`['responded', 'timeout', 'error'].includes(log.status)`). Add ref `replayLoading` to prevent double-clicks. Add replay badge: if `log.replayed_from` is truthy, show a Tag with `value="Replay"` `severity="info"` and `icon="pi pi-replay"` next to the timestamp in the header bar.
- [x] T006 [US1] Show replay badge in LogList status column in src/components/logs/LogList.vue — In the status column template, after the existing status Tag, conditionally render a small replay indicator when `slotProps.data.replayed_from` is truthy. Use a PrimeVue Tag with `value="Replay"` `severity="info"` `class="ml-1"` or an inline `<i class="pi pi-replay text-blue-500 ml-1" title="Replayed webhook" />` icon. Keep it compact to not clutter the table row.

**Checkpoint**: Replay is functional — click Replay on any terminal log, new log appears with badge, relay forwards it automatically.

---

## Phase 4: User Story 2 + 3 — Text Search + Method/Status Filters (Priority: P2)

**Goal**: Users can search logs by text and filter by HTTP method and status. Combined because they share the same LogFilters component.

**Independent Test**: Type a search term, select method/status filters, verify only matching logs appear. Verify URL updates with filter params.

### Implementation for User Story 2 + 3

- [x] T007 [P] [US2] Create LogFilters component in src/components/logs/LogFilters.vue — Props: `modelValue` (Object with shape `{ q: '', method: [], status: [], from: null, to: null }`). Emits: `update:modelValue`, `clear`. Import PrimeVue InputText, MultiSelect, Button. Template: a flex row container (`flex flex-wrap gap-3 items-end mb-4`). Text search: InputText with placeholder "Search logs..." and a `pi-search` icon (use PrimeVue IconField + InputIcon pattern if available, else plain InputText with class). Method filter: MultiSelect with `:options="methodOptions"` where methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as simple string array, placeholder "Method", `display="chip"`, `class="w-48"`. Status filter: MultiSelect with `:options="statusOptions"` where statusOptions = ['pending', 'forwarding', 'responded', 'timeout', 'error'], placeholder "Status", `display="chip"`, `class="w-48"`. "Clear all" Button: only visible when any filter is active, `severity="secondary"` `text` `icon="pi pi-filter-slash"` label "Clear filters" emitting `clear` event. Each input emits `update:modelValue` with the updated filters object on change. For the text search input, apply 300ms debounce using a local ref + `setTimeout`/`clearTimeout` pattern before emitting.
- [x] T008 [US2] Integrate LogFilters into LogList with URL query sync in src/components/logs/LogList.vue — Import LogFilters, `useRouter`, `useRoute`. Add `filters` ref initialized from `route.query`: `{ q: route.query.q || '', method: route.query.method ? route.query.method.split(',') : [], status: route.query.status ? route.query.status.split(',') : [] }`. On LogFilters `update:modelValue`, update local `filters` ref, call corresponding store actions (`store.setSearchQuery`, `store.setMethodFilter`, `store.setStatusFilter`), and call `router.replace({ query: buildQueryParams() })` where `buildQueryParams()` constructs the query object from all active filters (omitting empty values). On LogFilters `clear` event, call `store.clearAllFilters()`, reset local `filters`, and `router.replace({ query: {} })`. Render `<LogFilters v-model="filters" @clear="clearFilters" />` above the DataTable. On mounted, if route.query has filter params, apply them to the store before fetching. Show empty state "No logs match your filters" with a "Clear filters" link when `store.logs.length === 0 && !store.loading && store.hasActiveFilters`.

**Checkpoint**: Search and method/status filtering work. URL reflects active filters and survives page refresh.

---

## Phase 5: User Story 4 — Date Range Filter (Priority: P3)

**Goal**: Users can filter logs by date range using a date picker.

**Independent Test**: Select a date range, verify only logs within that range appear.

### Implementation for User Story 4

- [x] T009 [US4] Add date range picker to LogFilters in src/components/logs/LogFilters.vue — Import PrimeVue DatePicker (was Calendar in PrimeVue 3, renamed to DatePicker in PrimeVue 4). Add a DatePicker with `selectionMode="range"` `showTime` `hourFormat="24"` `placeholder="Date range"` `dateFormat="yy-mm-dd"` `class="w-64"`. Bind to a local `dateRange` ref (array of two dates or null). On change, extract `from` (dateRange[0]) and `to` (dateRange[1]) and emit via `update:modelValue` with the updated filters object. Show a clear button (x icon) on the date picker to reset the range.
- [x] T010 [US4] Wire date range to store and URL sync in src/components/logs/LogList.vue — Update the `filters` ref initialization to include `from` and `to` from `route.query` (parse ISO strings back to Date objects). Update `buildQueryParams()` to include `from` and `to` (as ISO strings). On LogFilters `update:modelValue` with date changes, call `store.setDateRange(from, to)`. On mounted, if `route.query.from` or `route.query.to` exist, apply them to the store.

**Checkpoint**: Date range filtering works end-to-end with URL sync.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tests, quality checks, and validation

- [x] T011 [P] Write unit tests for new store actions in tests/unit/stores/logs.test.js — Add tests: `setMethodFilter()` updates filter, resets page, calls fetchLogs. `setStatusFilter()` updates filter, resets page, calls fetchLogs. `setSearchQuery()` updates query, resets page, calls fetchLogs. `setDateRange()` updates dates, resets page, calls fetchLogs. `clearAllFilters()` resets all filters and calls fetchLogs. `hasActiveFilters` computed returns correct values. `replayLog()` calls POST API and returns data. `matchesFilters()` correctly filters Realtime INSERT events. `fetchLogs()` includes filter params in API call.
- [x] T012 [P] Write unit tests for LogFilters component in tests/unit/components/LogFilters.test.js — Test: renders search input, method multi-select, status multi-select. Test: emits `update:modelValue` on search input (debounced). Test: emits `update:modelValue` on method selection change. Test: emits `update:modelValue` on status selection change. Test: "Clear filters" button visible only when filters active. Test: emits `clear` event on clear button click. Use @vue/test-utils mount with PrimeVue plugin.
- [x] T013 Run lint, format, and build checks — Execute `npm run lint:fix && npm run format && npm run build` to ensure all new code passes quality gates.
- [x] T014 Run quickstart.md validation steps — Follow the verification steps in specs/008-replay-search/quickstart.md to validate replay and search features end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Can run in parallel with Phase 1 (store can be coded before API is deployed, but needs API at runtime)
- **US1 (Phase 3)**: Depends on Phase 1 (replay API) and Phase 2 (store replay action)
- **US2+US3 (Phase 4)**: Depends on Phase 1 (extended GET /api/logs) and Phase 2 (store filter state)
- **US4 (Phase 5)**: Depends on Phase 4 (adds to LogFilters component created in Phase 4)
- **Polish (Phase 6)**: Depends on Phases 3, 4, and 5

### User Story Dependencies

- **US1 (P1)**: Independent — only needs API + store foundation
- **US2+US3 (P2)**: Independent of US1 — only needs API + store foundation
- **US4 (P3)**: Depends on US2+US3 — adds date range to the LogFilters component created in Phase 4

### Within Each Phase

- T001, T002, T003 can run in parallel (different files)
- T004 depends on T002/T003 being designed (for API contract) but can be coded in parallel
- T005, T006 are independent within US1 (different files)
- T007 can run in parallel with T005/T006 (different file)
- T008 depends on T007 (LogFilters must exist before integration)
- T009 depends on T007 (extends LogFilters)
- T010 depends on T008 and T009
- T011, T012 can run in parallel (different test files)

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different files)
- T005 and T006 can run in parallel (different Vue files)
- T007 can run in parallel with T005/T006 (different component)
- T011 and T012 can run in parallel (different test files)

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup (migration + APIs)
2. Complete Phase 2: Foundational (store extensions)
3. Complete Phase 3: US1 (replay button + badge)
4. **STOP and VALIDATE**: Replay a webhook, verify new log appears with badge and gets forwarded
5. Deploy/demo if ready — replay is functional

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Replay works → MVP!
3. US2+US3 → Search + method/status filters → Core filtering
4. US4 → Date range filter → Complete feature
5. Polish → Tests + validation → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US2 and US3 share the same phase because the LogFilters component serves both search and method/status filtering — they can't be meaningfully separated
- US4 builds on the LogFilters component from US2+US3, adding a date range picker
- The browser relay requires NO changes — replayed logs are regular `pending` records that the existing relay automatically detects and forwards
- The `replayed_from` column is nullable: null = original webhook, non-null = replay
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
