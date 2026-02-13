# Tasks: Dashboard

**Input**: Design documents from `/specs/009-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create shared components and the dashboard composable that all user stories depend on

- [x] T001 Create dashboard composable in src/composables/use-dashboard.js — Define state refs: `recentLogs` (ref([])), `requestCount24h` (ref(0)), `loadingStats` (ref(false)), `channel` (ref(null)). Import `useEndpointsStore` and `useAuthStore`. Add computed properties: `totalEndpoints` (endpoints.length), `activeEndpoints` (endpoints.filter(e => e.is_active).length), `inactiveEndpoints` (endpoints.filter(e => !e.is_active).length), `hasEndpoints` (totalEndpoints > 0). Add `fetchStats()` action: make two parallel API calls — (1) `GET /api/logs?limit=10` to populate `recentLogs` with the 10 most recent logs, (2) `GET /api/logs?limit=1&from=<24h-ago-ISO>` to extract `total` into `requestCount24h`. Both calls use auth headers from `useAuthStore().session.access_token`. Set `loadingStats = true` before calls, `false` after. Export all state, computed, and actions.
- [x] T002 [P] Create StatCard component in src/components/dashboard/StatCard.vue — Props: `label` (String, required), `value` (Number or String, required), `icon` (String, optional — PrimeIcons class like "pi pi-link"), `severity` (String, optional — "info", "success", "warn", "danger"). Template: a PrimeVue Card with compact padding. Display the `value` as a large number and `label` below it in smaller text. If `icon` is provided, show it to the left of the value. Apply Tailwind color classes based on `severity` (e.g., text-blue-600 for info, text-green-600 for success). Keep the component minimal — no state, no logic, pure presentation.
- [x] T003 [P] Create `formatTimeAgo` utility function in src/composables/use-dashboard.js — Add a helper function (not exported, used internally and by ActivityFeed): takes a timestamp string, returns a relative time string. Logic: compute diff in seconds from `Date.now()`. If <60s → "just now". If <3600s → `${Math.floor(diff/60)} min ago`. If <86400s → `${Math.floor(diff/3600)}h ago`. If >=86400s → `${Math.floor(diff/86400)}d ago`. Export it for use in components.

**Checkpoint**: Dashboard composable and shared components ready for user story implementation

---

## Phase 2: User Story 1 + 2 — Endpoint Overview + Quick Actions (Priority: P1)

**Goal**: Users see summary stats, a list of all endpoints with quick actions (copy URL, toggle, navigate), relay status, and onboarding state for new users.

**Independent Test**: Log in with endpoints, verify stats are correct, copy a webhook URL, toggle an endpoint, navigate to logs and endpoint detail. Log in as new user, verify onboarding state.

### Implementation for User Story 1 + 2

- [x] T004 [P] [US1] Create DashboardEndpointCard component in src/components/dashboard/DashboardEndpointCard.vue — Props: `endpoint` (Object, required). Emits: `toggle`. Import PrimeVue Tag, Button, ToggleSwitch. Import `useToast` from primevue/usetoast. Import `useRouter`. Compute `webhookUrl`: `${window.location.origin}/hook/${endpoint.slug}`. Compute `targetSummary`: `${endpoint.target_url}:${endpoint.target_port}${endpoint.target_path}`. Template: PrimeVue Card with compact layout. Header row: endpoint name (clickable, navigates to `/endpoints/${endpoint.id}` via router.push), active/inactive Tag (severity "success"/"danger"), ToggleSwitch bound to `endpoint.is_active` emitting `toggle`. Body: webhook URL in monospace with a copy Button (icon "pi pi-copy", text, small). On copy click: `navigator.clipboard.writeText(webhookUrl)` then toast "URL copied". Below URL: target summary in small text. Footer: "View Logs" Button (severity="secondary", text, small, navigates to `/logs?endpoint_id=${endpoint.id}` — but since LogList accepts endpointId prop, navigate to `/endpoints/${endpoint.id}` logs tab or `/logs` with query param).
- [x] T005 [US1] Rewrite DashboardView with summary stats, endpoint list, and onboarding in src/views/DashboardView.vue — Import `useDashboard` composable, `useEndpoints` composable, `useRelay` composable. Import StatCard, DashboardEndpointCard, RelayStatus, ProgressSpinner, Button. On mounted: call `endpoints.fetchEndpoints()` if not already loaded, then `dashboard.fetchStats()`. Template structure: (A) If `loadingStats && !dashboard.hasEndpoints` → show ProgressSpinner. (B) If `!dashboard.hasEndpoints && !loadingStats` → onboarding state: centered Card with "Welcome to HookSpy" title, descriptive text, and a "Create Your First Endpoint" Button navigating to `/endpoints/new`. (C) Else → full dashboard: (1) Stats row: 4 StatCards in a flex/grid row — "Endpoints" (totalEndpoints, icon "pi pi-link"), "Active" (activeEndpoints, severity "success", icon "pi pi-check-circle"), "Inactive" (inactiveEndpoints, severity "warn", icon "pi pi-pause-circle"), "Requests (24h)" (requestCount24h, icon "pi pi-inbox"). (2) Below stats: two-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-6`). Left column: "Your Endpoints" heading + list of DashboardEndpointCard for each endpoint. On toggle emit: call `endpoints.toggleActive(endpoint.id)`. Right column: placeholder for Activity Feed (Phase 3). (3) RelayStatus is already shown in AppHeader — do not duplicate. Responsive: stats row wraps on mobile (`flex flex-wrap` or `grid grid-cols-2 sm:grid-cols-4`).

**Checkpoint**: Dashboard shows summary stats, endpoint list with copy/toggle/navigate quick actions, and onboarding state. US1 and US2 acceptance scenarios verifiable.

---

## Phase 3: User Story 3 — Recent Activity Feed (Priority: P2)

**Goal**: Users see the 10 most recent webhook events in a compact feed that updates in real time.

**Independent Test**: View dashboard with recent activity, verify feed shows 10 entries with endpoint name, method, status, relative time. Send a new webhook, verify it appears at the top within 2 seconds.

### Implementation for User Story 3

- [x] T006 [US3] Add Realtime subscription to dashboard composable in src/composables/use-dashboard.js — Import `useSupabase` and `useEndpointsStore`. Add `startSubscription()`: get all endpoint IDs from endpoints store. If none, return. Create Supabase Realtime channel named `dashboard-activity`. Subscribe to INSERT events on `webhook_logs` with `endpoint_id=in.(ids)` filter. On INSERT: prepend `payload.new` to `recentLogs`, trim to 10 entries (`recentLogs.value = [payload.new, ...recentLogs.value].slice(0, 10)`), increment `requestCount24h`. Subscribe to UPDATE events: find matching log in `recentLogs` by id and merge changes (for status transitions like pending → responded). Add `stopSubscription()`: if channel exists, call `client.removeChannel(channel.value)`, set to null. Export both functions.
- [x] T007 [P] [US3] Create ActivityFeed component in src/components/dashboard/ActivityFeed.vue — Props: `logs` (Array, required), `loading` (Boolean, default false). Import PrimeVue Tag, ProgressSpinner. Import `useRouter`. Import `formatTimeAgo` from use-dashboard.js composable. Add a `timeNow` ref updated every 60 seconds via `setInterval` (cleared in `onUnmounted`) to force re-renders of relative timestamps. Template: (A) If `loading && logs.length === 0` → ProgressSpinner. (B) If `!loading && logs.length === 0` → empty state: icon "pi pi-inbox", text "No recent activity". (C) Else → list of items. Each item is a clickable row (navigates to log detail or expands inline — simplest: navigate to `/logs` with the log visible). Row layout: left side has endpoint name (small, bold), below it the relative time (`formatTimeAgo(log.received_at)`). Right side has a method Tag (severity mapped: GET=info, POST=success, PUT/PATCH=warn, DELETE=danger) and a status Tag (pending=info, forwarding=info, responded=success, timeout=warn, error=danger). Add hover effect for clickability. On click: `router.push({ name: 'logs' })` — simple navigation to logs view.
- [x] T008 [US3] Integrate ActivityFeed into DashboardView in src/views/DashboardView.vue — In the right column of the two-column grid (replacing the placeholder), add: "Recent Activity" heading and `<ActivityFeed :logs="dashboard.recentLogs" :loading="dashboard.loadingStats" />`. In the `onMounted` hook, after `dashboard.fetchStats()`, call `dashboard.startSubscription()`. In `onUnmounted`, call `dashboard.stopSubscription()`. The activity feed now updates in real time when new webhooks arrive.

**Checkpoint**: Activity feed shows recent events with real-time updates. US3 acceptance scenarios verifiable.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Tests, quality checks, and validation

- [x] T009 [P] Write unit tests for dashboard composable in tests/unit/composables/use-dashboard.test.js — Mock fetch and Supabase client. Test: `fetchStats()` makes two API calls and populates `recentLogs` and `requestCount24h`. Test: computed properties (`totalEndpoints`, `activeEndpoints`, `inactiveEndpoints`, `hasEndpoints`) return correct values. Test: `formatTimeAgo()` returns correct strings for various time diffs (just now, minutes, hours, days). Test: `startSubscription()` creates Realtime channel. Test: `stopSubscription()` removes channel.
- [x] T010 [P] Write unit tests for ActivityFeed component in tests/unit/components/ActivityFeed.test.js — Test: renders empty state when no logs. Test: renders log entries with endpoint name, method tag, status tag, and relative time. Test: renders loading spinner when loading prop is true. Mount with PrimeVue plugin and mock matchMedia (same pattern as LogFilters.test.js).
- [x] T011 Run lint, format, and build checks — Execute `npm run lint:fix && npm run format && npm run build` to ensure all new code passes quality gates.
- [x] T012 Run quickstart.md validation steps — Follow the verification steps in specs/009-dashboard/quickstart.md to validate all dashboard features end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1+US2 (Phase 2)**: Depends on T001 (composable) and T002 (StatCard). T003 can be deferred to Phase 3.
- **US3 (Phase 3)**: Depends on Phase 2 (DashboardView must exist to integrate ActivityFeed)
- **Polish (Phase 4)**: Depends on Phases 2 and 3

### User Story Dependencies

- **US1+US2 (P1)**: Combined because they share the same view and quick actions are on the endpoint cards. Can start after Phase 1 setup.
- **US3 (P2)**: Independent of US1+US2 in logic, but integrates into DashboardView created in Phase 2.

### Within Each Phase

- T001 must complete before T005 (composable needed by view)
- T002, T003 can run in parallel with T001 (different files)
- T004 can run in parallel with T002, T003 (different file)
- T005 depends on T001, T002, T004
- T006 depends on T001 (extends composable)
- T007 can run in parallel with T006 (different file)
- T008 depends on T006, T007
- T009, T010 can run in parallel (different test files)

### Parallel Opportunities

- T002, T003, T004 can all run in parallel (different files)
- T006 and T007 can run in parallel (different files)
- T009 and T010 can run in parallel (different test files)

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (composable + StatCard + formatTimeAgo)
2. Complete Phase 2: US1+US2 (endpoint cards + dashboard view)
3. **STOP and VALIDATE**: Stats correct, quick actions work, onboarding shows for new users
4. Deploy/demo if ready — dashboard is functional

### Incremental Delivery

1. Setup → Foundation ready
2. US1+US2 → Overview + quick actions → MVP!
3. US3 → Activity feed with real-time → Full feature
4. Polish → Tests + validation → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined into Phase 2 because they share the same view and the endpoint cards inherently provide both overview (US1) and quick actions (US2)
- No new API endpoints or database changes — all data from existing infrastructure
- The relay status indicator is already in AppHeader via RelayStatus.vue — no duplication needed
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
