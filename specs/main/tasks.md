# Tasks: Subscription Tiers & Admin Panel

**Input**: Design documents from `specs/main/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per constitution principle IV (Meaningful Testing). Tests cover composables, stores, API helpers, and component behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Foundation)

**Purpose**: Create all new database tables, triggers, RLS policies, and seed data. These are blocking prerequisites for all feature work.

- [x] T001 Create profiles table with trigger and RLS policies in `supabase/migrations/20260224000001_create_profiles.sql` — includes: profiles table (id, email, display_name, plan, role, status, plan_changed_at, stripe_customer_id, stripe_subscription_id, created_at, updated_at), CHECK constraints for plan/role/status, indexes on plan/status/email, `handle_new_user()` trigger on auth.users INSERT, `update_updated_at()` trigger, RLS policies (profiles_select_own, profiles_update_own, admins_select_all, admins_update_all), backfill existing auth.users into profiles
- [x] T002 Create plan_config table with seed data in `supabase/migrations/20260224000002_create_plan_config.sql` — includes: plan_config table (plan PK, max_endpoints, requests_per_min, max_body_bytes, log_retention_hours, max_timeout_seconds, can_replay, can_search, can_inject_headers, updated_at), RLS (authenticated SELECT, admin UPDATE), seed Free row (3, 30, 262144, 6, 30, false, false, false) and Pro row (25, 120, 5242880, 168, 55, true, true, true)
- [x] T003 Create rate_limits table with cleanup job in `supabase/migrations/20260224000003_create_rate_limits.sql` — includes: rate_limits table (key text PK, count int, window_start timestamptz), RLS disabled, pg_cron hourly cleanup job deleting rows with window_start older than 5 minutes
- [x] T004 Create admin_audit_log table with RLS in `supabase/migrations/20260224000004_create_admin_audit_log.sql` — includes: admin_audit_log table (id uuid PK, admin_id FK, target_user_id FK, action text, old_value jsonb, new_value jsonb, created_at), indexes on admin_id/target_user_id/created_at DESC, RLS (admin SELECT only, service role INSERT)
- [x] T005 Update log retention to be plan-aware in `supabase/migrations/20260224000005_update_log_retention.sql` — replace existing 24h flat cleanup with plan-aware job: join webhook_logs → endpoints → profiles to get plan, delete Free logs > 6h and Pro logs > 7d
- [x] T006 Seed admin user in `supabase/migrations/20260224000006_seed_admin.sql` — check if configured admin email exists in auth.users, if so update profile role to 'admin', otherwise log notice with manual instructions

---

## Phase 2: Foundational (API Middleware)

**Purpose**: Core API infrastructure that ALL user stories depend on. Must be complete before any endpoint or frontend work.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Create plan enforcement middleware in `api/_lib/plans.js` — exports: `getPlanLimits(plan)` queries plan_config table with in-memory cache (short TTL per serverless invocation), `getUserPlan(userId)` queries profiles for plan + status, `checkEndpointLimit(userId)` counts user endpoints vs plan max returning `{ allowed, current, max }`, `checkRateLimit(endpointSlug, plan)` performs atomic upsert on rate_limits table using fixed 1-minute tumbling window returning `{ allowed, remaining, resetAt }`, `requireAdmin(req)` verifies caller profile has role='admin' or returns 403
- [x] T008 Extend auth helper with profile and status check in `api/_lib/auth.js` — modify `verifyAuth(req)` to also query profiles table and return `{ user, profile, error }` where profile includes plan/role/status; if profile.status is 'disabled' return `{ user: null, profile: null, error: 'account_disabled' }`; lazy session invalidation per clarification

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — New User Gets Free Plan by Default (Priority: P1) MVP

**Goal**: Every new user automatically gets a Free plan profile on registration. Plan badge visible in UI. Settings page shows plan info.

**Independent Test**: Register a new account, verify profile row exists with plan='free' and role='user'. Verify plan badge appears in header.

### Implementation for User Story 1

- [x] T009 [US1] Modify auth store to fetch and expose profile on login in `src/stores/auth.js` — after successful auth, fetch profile from GET /api/profile; expose `profile` (reactive), `plan`, `role`, `isAdmin` as computed getters; handle 401 account_disabled by signing out with message
- [x] T010 [US1] Create useUserPlan composable in `src/composables/use-user-plan.js` — wraps auth store profile data; exposes: `plan`, `limits`, `canReplay`, `canSearch`, `canInjectHeaders`, `endpointsRemaining`, `isAdmin`, `isPro`, `isFree`; fetches plan_config from Supabase for current plan limits; caches until login/plan change
- [x] T011 [US1] Create PlanBadge component in `src/components/settings/PlanBadge.vue` — displays "Free" or "Pro" badge using PrimeVue Tag component; green for Pro, gray for Free; accepts `plan` prop
- [x] T012 [US1] Add plan badge to app header in `src/components/layout/AppHeader.vue` — import PlanBadge and useUserPlan; show plan badge next to user email in header; add "Admin" nav link visible only when isAdmin is true
- [x] T013 [US1] Create profile API endpoint in `api/profile/index.js` — GET: return current user profile with plan limits (from plan_config) and usage stats (endpoints count/active); PUT: update display_name only (max 100 chars), reject plan/role/status changes; use verifyAuth for auth + status check; handle CORS
- [x] T014 [US1] Create SettingsView in `src/views/SettingsView.vue` — display: email (read-only), display_name (editable via inline edit), current plan with PlanBadge, usage stats (endpoints used/max via PlanUsage), "Learn about Pro" card for Free users
- [x] T015 [P] [US1] Create PlanUsage component in `src/components/settings/PlanUsage.vue` — displays usage bars/fractions for endpoints (e.g., "2/3 endpoints used") using PrimeVue ProgressBar; accepts current/max props
- [x] T016 [P] [US1] Create PlanComparison component in `src/components/settings/PlanComparison.vue` — feature comparison table (Free vs Pro) using PrimeVue DataTable; shows all limit dimensions with checkmarks for boolean features
- [x] T017 [US1] Add /settings route to router in `src/router/index.js` — add protected route `/settings` pointing to SettingsView; add meta for auth guard

**Checkpoint**: New users get Free plan on signup. Plan badge visible. Settings page shows plan info and usage.

---

## Phase 4: User Story 2 — Free User Hits Endpoint Limit (Priority: P1)

**Goal**: Free users are blocked from creating more than 3 endpoints with a clear upgrade message. Usage indicator visible on endpoints page.

**Independent Test**: As a Free user with 3 endpoints, attempt to create a 4th. Verify 403 with descriptive message. Verify "3/3 endpoints used" indicator.

### Implementation for User Story 2

- [x] T018 [US2] Add endpoint limit check to endpoint creation API in `api/endpoints/index.js` — in POST handler, call `checkEndpointLimit(user.id)` before creating; if not allowed, return 403 with `{ error: 'Endpoint limit reached', message: 'Free plan allows up to N endpoints. Upgrade to Pro for up to M.', current, max }`
- [x] T019 [US2] Add active endpoint toggle limit to endpoint update API in `api/endpoints/[id].js` — when activating an endpoint (is_active → true), check active count ≤ plan max; if at limit, return 403 with `{ error: 'Active endpoint limit reached', message: 'Deactivate another endpoint first to activate this one.', active, max }`
- [x] T020 [US2] Add usage indicator to endpoints view in `src/views/EndpointsView.vue` — show "N/M endpoints used" using PlanUsage component above the endpoint list; when at limit, show upgrade prompt instead of "Create Endpoint" button
- [x] T021 [US2] Gate activate toggle in EndpointCard in `src/components/endpoints/EndpointCard.vue` — when toggling active, check endpointsRemaining from useUserPlan; if 0 and trying to activate, show toast with "Deactivate another endpoint first"

**Checkpoint**: Endpoint creation and activation are plan-limited. Usage indicator visible.

---

## Phase 5: User Story 3 — Free User Restricted from Pro-Only Features (Priority: P1)

**Goal**: Replay, advanced search, and custom header injection are gated for Free users in both UI and API.

**Independent Test**: As a Free user, verify replay button is locked, advanced filters are disabled, custom headers section is disabled. Verify API returns 403 for replay and ignores advanced search params.

### Implementation for User Story 3

- [x] T022 [US3] Create ProGate wrapper component in `src/components/shared/ProGate.vue` — slot-based wrapper; when user is Free and feature is gated, renders a disabled overlay with lock icon and "Pro feature" tooltip (PrimeVue Tooltip); accepts `feature` prop ('replay', 'search', 'headers'); uses useUserPlan to check access
- [x] T023 [US3] Gate replay in API in `api/logs/[id]/replay.js` — after auth check, get user plan via profile; if `can_replay` is false, return 403 with `{ error: 'Pro feature', message: 'Replay is available on the Pro plan.' }`
- [x] T024 [US3] Gate replay button in log detail view in `src/components/logs/LogDetail.vue` — wrap replay button with ProGate component; if Free, show locked state with "Pro" badge
- [x] T025 [US3] Restrict search params for Free users in API in `api/logs/index.js` — after auth, get user plan; if `can_search` is false, strip `q`, `method`, `from`, `to` params from query (only process endpoint_id, status, page, limit)
- [x] T026 [US3] Gate advanced filters in log filters UI in `src/components/logs/LogFilters.vue` — disable text search input, method filter, and date range picker for Free users using ProGate; status filter remains enabled
- [x] T027 [US3] Strip custom headers for Free users in API in `api/endpoints/index.js` and `api/endpoints/[id].js` — in POST and PUT handlers, if user plan `can_inject_headers` is false, silently remove `custom_headers` from request body
- [x] T028 [US3] Gate custom headers editor in endpoint form in `src/components/endpoints/EndpointForm.vue` — wrap HeaderInjectionEditor with ProGate; if Free, show disabled state with "Pro feature" label

**Checkpoint**: All Pro-only features gated in both UI and API.

---

## Phase 6: User Story 4 — Free User Has Reduced Rate Limit and Body Size (Priority: P1)

**Goal**: Webhook receiver enforces per-plan rate limits, body size caps, and timeout caps.

**Independent Test**: Send 31 requests/min to a Free endpoint, verify 429 on 31st. Send 300KB body to Free endpoint, verify 413.

### Implementation for User Story 4

- [x] T029 [US4] Modify webhook receiver for plan-based enforcement in `api/hook/[slug].js` — after endpoint lookup, join to profiles to get owner's plan and status; if owner is disabled return 403; replace in-memory rate limiting with database-backed `checkRateLimit(slug, plan)` from plans.js; check body size against plan's `max_body_bytes` returning 413 with max_size if exceeded; cap effective timeout to min(endpoint.timeout_seconds, plan.max_timeout_seconds); add `Retry-After` header to 429 responses (seconds until next minute boundary)

**Checkpoint**: Webhook receiver enforces all plan-based limits.

---

## Phase 7: User Story 5 — Free User Has Reduced Log Retention (Priority: P2)

**Goal**: Logs are cleaned up based on the owning user's plan (6h Free, 7d Pro).

**Independent Test**: Verify pg_cron cleanup deletes Free user logs older than 6h but retains Pro user logs of the same age.

### Implementation for User Story 5

- [x] T030 [US5] Apply plan-aware log retention migration in Supabase — migration T005 already handles this; verify the updated cleanup job correctly joins webhook_logs → endpoints → profiles and uses plan_config.log_retention_hours
- [x] T031 [US5] Add retention notice to log viewer in `src/components/logs/LogList.vue` — for Free users, show a subtle note at the top: "Free plan retains logs for 6 hours" using PrimeVue Message component (severity info)

**Checkpoint**: Log retention is plan-aware.

---

## Phase 8: User Story 6 — Admin Views User List (Priority: P1)

**Goal**: Admin can view, search, and filter all users at `/admin/users`.

**Independent Test**: Log in as admin, navigate to `/admin/users`, verify paginated user table with search and filter.

### Implementation for User Story 6

- [x] T032 [US6] Create admin users list API in `api/admin/users/index.js` — GET handler: verify admin via requireAdmin; query profiles with pagination (20/page, max 100), search by email (ILIKE), filter by plan and status, sort by created_at/email/plan (asc/desc); join with endpoint counts and 24h request counts; return users array + pagination object per contract
- [x] T033 [US6] Create admin user detail API in `api/admin/users/[id]/index.js` — GET handler: verify admin; return single user profile with endpoints_count, endpoints_active, requests_24h; return 404 if not found
- [x] T034 [US6] Create admin store in `src/stores/admin.js` — Pinia store with: `users` (array), `usersPagination`, `stats`, `auditLog`; actions: `fetchUsers(params)`, `fetchUserDetail(id)`, `changePlan(id, plan)`, `changeStatus(id, status)`, `fetchStats()`, `fetchAuditLog(params)`; all API calls use auth headers
- [x] T035 [P] [US6] Create UserTable component in `src/components/admin/UserTable.vue` — PrimeVue DataTable with columns: email, plan (with PlanBadge), role, endpoints count, requests (24h), status (Tag component: green=active, red=disabled), joined date (relative); search input for email; dropdown filters for plan and status; pagination controls; row click navigates to user detail or opens actions
- [x] T036 [P] [US6] Create AdminLayout component in `src/components/admin/AdminLayout.vue` — sidebar with nav links (Dashboard, Users) using PrimeVue Menu; content area via slot; "Admin" heading; back link to main app
- [x] T037 [US6] Create AdminUsersView in `src/views/AdminUsersView.vue` — uses AdminLayout; mounts UserTable; fetches users on mount via admin store; passes search/filter/pagination state
- [x] T038 [US6] Add admin routes to router in `src/router/index.js` — add `/admin` redirect to `/admin/dashboard`, `/admin/dashboard` → AdminDashboardView, `/admin/users` → AdminUsersView; all with meta `{ requiresAdmin: true }`; add admin guard: if not admin, redirect to dashboard silently

**Checkpoint**: Admin can view all users with search/filter/pagination.

---

## Phase 9: User Story 7 — Admin Changes a User's Plan (Priority: P1)

**Goal**: Admin can upgrade/downgrade a user's plan. Downgrade auto-deactivates excess endpoints. All changes are audit-logged.

**Independent Test**: As admin, change a Free user to Pro. Verify profile updated. Change a Pro user with 10 endpoints to Free, verify 7 most recent endpoints deactivated.

### Implementation for User Story 7

- [x] T039 [US7] Create plan change API in `api/admin/users/[id]/plan.js` — PUT handler: verify admin via requireAdmin; validate plan is 'free' or 'pro'; prevent self-modification; update profiles.plan and plan_changed_at; if downgrading and active endpoints > new max, deactivate excess (ORDER BY created_at DESC LIMIT excess); insert admin_audit_log entry with action='plan_change', old_value={plan: old}, new_value={plan: new}; return updated profile + endpoints_deactivated count
- [x] T040 [US7] Create UserActions component in `src/components/admin/UserActions.vue` — inline action buttons per user row or detail view: "Change Plan" dropdown (Free/Pro) with confirmation dialog (PrimeVue ConfirmDialog); "Disable"/"Enable" button; uses admin store actions; shows toast on success; displays endpoints_deactivated count if downgrade

**Checkpoint**: Admin can change plans with audit logging and auto-deactivation.

---

## Phase 10: User Story 8 — Admin Disables/Enables a User Account (Priority: P2)

**Goal**: Admin can disable/enable accounts. Disabled users can't log in or receive webhooks.

**Independent Test**: Disable a user as admin. Verify their next API call returns 401. Verify their endpoints return 403.

### Implementation for User Story 8

- [x] T041 [US8] Create status change API in `api/admin/users/[id]/status.js` — PUT handler: verify admin; validate status is 'active' or 'disabled'; prevent self-modification; prevent disabling the last admin (count admins with status='active', if only 1 and target is that admin, return 400); update profiles.status; insert audit_log entry with action='status_change'; return updated profile
- [x] T042 [US8] Handle account_disabled error in frontend auth store in `src/stores/auth.js` — when any API call returns 401 with error='account_disabled', sign out user and redirect to login with toast: "Your account has been disabled. Contact support."

**Checkpoint**: Account disable/enable works with lazy invalidation.

---

## Phase 11: User Story 9 — Admin Views System-Wide Stats (Priority: P2)

**Goal**: Admin dashboard at `/admin` shows high-level system metrics.

**Independent Test**: Log in as admin, navigate to `/admin`. Verify stats cards show correct totals.

### Implementation for User Story 9

- [x] T043 [US9] Create admin stats API in `api/admin/stats.js` — GET handler: verify admin; query: total users (count profiles), users by plan (group by plan), users by status (group by status), total endpoints (count endpoints), total requests 24h (count webhook_logs where received_at > now() - 24h); return stats object per contract
- [x] T044 [P] [US9] Create AdminStats component in `src/components/admin/AdminStats.vue` — stat cards using PrimeVue Card: total users, Free/Pro breakdown, total endpoints, requests (24h); accepts stats object as prop
- [x] T045 [US9] Create AdminDashboardView in `src/views/AdminDashboardView.vue` — uses AdminLayout; mounts AdminStats; fetches stats on mount via admin store
- [x] T046 [US9] Add admin sidebar nav link in `src/components/layout/AppHeader.vue` — ensure "Admin" link added in T012 navigates to `/admin/dashboard`

**Checkpoint**: Admin dashboard shows system-wide stats.

---

## Phase 12: User Story 10 — User Views Account Settings (Priority: P2)

**Goal**: Users can view profile, plan, usage, and plan comparison on the settings page.

**Independent Test**: Navigate to `/settings` as Free user. Verify email, plan badge, usage stats, and "Learn about Pro" section.

### Implementation for User Story 10

- [x] T047 [US10] Finalize SettingsView with all sections in `src/views/SettingsView.vue` — ensure T014 implementation includes: PlanUsage component with real endpoint data from useUserPlan, PlanComparison table, "Learn about Pro" card (PrimeVue Card) with placeholder upgrade CTA for Free users, display_name edit with save to PUT /api/profile

**Checkpoint**: Settings page fully functional with plan info and usage.

---

## Phase 13: User Story 11 — Audit Log Viewing (Priority: P2)

**Goal**: Admin can view audit log of all plan/status changes.

**Independent Test**: After performing plan changes, navigate to `/admin/audit-log` or view audit entries on admin dashboard.

### Implementation for User Story 11

- [x] T048 [US11] Create audit log API in `api/admin/audit-log.js` — GET handler: verify admin; query admin_audit_log with pagination (50/page), optional filters by target_user_id and action; join profiles for admin_email and target_email; return entries array + pagination per contract
- [x] T049 [US11] Add audit log display to admin panel — either as a tab in AdminUsersView or a dedicated section in AdminDashboardView; use PrimeVue DataTable with columns: admin email, target email, action, old/new values, timestamp; uses admin store fetchAuditLog action

**Checkpoint**: Audit log is viewable by admins.

---

## Phase 14: Tests

**Purpose**: Unit and component tests per constitution principle IV.

- [ ] T050 [P] Write unit tests for plans.js middleware in `tests/unit/api/plans.test.js` — test getPlanLimits returns correct limits for free/pro, test checkEndpointLimit returns allowed/blocked correctly, test checkRateLimit increments and blocks at limit
- [ ] T051 [P] Write unit tests for use-user-plan composable in `tests/unit/composables/use-user-plan.test.js` — test computed flags (canReplay, canSearch, canInjectHeaders, isPro, isFree), test endpointsRemaining calculation
- [ ] T052 [P] Write unit tests for admin store in `tests/unit/stores/admin.test.js` — test fetchUsers/fetchStats/changePlan/changeStatus actions, test error handling
- [ ] T053 [P] Write component tests for ProGate in `tests/unit/components/ProGate.test.js` — test renders slot content when allowed, test renders locked state with badge when gated
- [ ] T054 [P] Write component tests for PlanBadge in `tests/unit/components/PlanBadge.test.js` — test renders "Free" and "Pro" badges with correct styling

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, edge cases, and verification.

- [ ] T055 Handle missing profile edge case in `src/stores/auth.js` — if GET /api/profile returns 404 (trigger failed), retry profile creation lazily or show clear error message
- [ ] T056 Add upgrade prompts to all gated UI locations — review all ProGate usages and ensure consistent CTA text pointing to settings or admin contact
- [ ] T057 Verify Vercel routing for new API paths — ensure `vercel.json` handles `/api/admin/*` and `/api/profile/*` routes correctly; SPA rewrites don't interfere with new API paths
- [ ] T058 Run quickstart.md verification checklist — manually verify all 10 checklist items from quickstart.md pass end-to-end
- [ ] T059 Run lint and format checks — `npm run lint:fix && npm run format && npm run test` to ensure CI pipeline passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migrations must be applied)
- **Phases 3-13 (User Stories)**: All depend on Phase 2 completion
  - US1 (Phase 3) should be completed first as it creates shared components (PlanBadge, useUserPlan, SettingsView shell)
  - US2-US5 (Phases 4-7) can proceed in parallel after US1
  - US6 (Phase 8) can proceed in parallel with US2-US5
  - US7-US11 (Phases 9-13) depend on US6 (admin store, layout, routes)
- **Phase 14 (Tests)**: Can start after Phase 2; tests can be written alongside implementation
- **Phase 15 (Polish)**: After all user stories complete

### User Story Dependencies

```
Phase 1 (DB) → Phase 2 (API Middleware)
                    │
                    ├── US1 (Profile + Plan Badge) ──┐
                    │                                 │
                    ├── US2 (Endpoint Limits) ────────┤ (uses useUserPlan from US1)
                    ├── US3 (Feature Gating) ─────────┤ (uses ProGate from US3, useUserPlan from US1)
                    ├── US4 (Rate Limits) ────────────┤ (API-only, no US1 dep)
                    ├── US5 (Log Retention) ──────────┤ (mostly migration, no US1 dep)
                    │                                 │
                    ├── US6 (Admin User List) ────────┤ (uses AdminLayout, admin store)
                    │         │                       │
                    │         ├── US7 (Plan Change) ──┤ (uses UserActions, admin store)
                    │         ├── US8 (Disable User) ─┤
                    │         ├── US9 (Admin Stats) ──┤
                    │         └── US11 (Audit Log) ───┘
                    │
                    └── US10 (Settings Page) ─────── (uses components from US1)
```

### Within Each User Story

- API endpoints before frontend components that consume them
- Shared components (ProGate, PlanBadge) before components that use them
- Store actions before views that call them

### Parallel Opportunities

- **Phase 1**: T001-T006 can all run in parallel (independent migrations)
- **Phase 2**: T007 and T008 can run in parallel (different files)
- **US1**: T015 and T016 can run in parallel (independent components)
- **US3**: T023+T025+T027 (API changes) can run in parallel; T024+T026+T028 (UI changes) can run in parallel
- **US6**: T035 and T036 can run in parallel (independent components)
- **US9**: T044 can run in parallel with T043 (component vs API)
- **Phase 14**: All test tasks (T050-T054) can run in parallel

---

## Parallel Example: User Story 3 (Feature Gating)

```bash
# Launch API gating tasks in parallel (different files):
Task: "Gate replay in API in api/logs/[id]/replay.js"               # T023
Task: "Restrict search params in API in api/logs/index.js"           # T025
Task: "Strip custom headers in API in api/endpoints/index.js"        # T027

# Then launch UI gating tasks in parallel (different files):
Task: "Gate replay button in src/components/logs/LogDetail.vue"      # T024
Task: "Gate advanced filters in src/components/logs/LogFilters.vue"  # T026
Task: "Gate headers editor in src/components/endpoints/EndpointForm.vue" # T028
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Database migrations (T001-T006)
2. Complete Phase 2: API middleware (T007-T008)
3. Complete Phase 3: User Story 1 (T009-T017)
4. **STOP and VALIDATE**: Register a user, verify Free plan, verify plan badge
5. Deploy if ready — basic plan infrastructure works

### Incremental Delivery

1. Setup + Foundation → DB and middleware ready
2. US1 (Profile + Badge) → **MVP — deploy**
3. US2 (Endpoint Limits) + US3 (Feature Gating) → Plan enforcement live
4. US4 (Rate Limits) + US5 (Retention) → Server-side hardening
5. US6 (Admin List) → Admin can see users
6. US7 (Plan Change) + US8 (Disable) → Admin can manage users
7. US9 (Stats) + US10 (Settings) + US11 (Audit) → Complete feature
8. Tests + Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- The spec defines 10 user stories but US11 (Audit Log) was extracted from US7/US9 as a cross-cutting concern
