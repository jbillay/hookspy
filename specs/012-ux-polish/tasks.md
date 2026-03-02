# Tasks: UX Polish & Improvements

**Input**: Design documents from `/specs/012-ux-polish/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Tests included only for critical behavioral changes (Settings loading fix, onboarding composable).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install new dependency and prepare migration

- [x] T001 Install driver.js dependency: `npm install driver.js --legacy-peer-deps`
- [x] T002 [P] Create Supabase migration file `supabase/migrations/[timestamp]_add_onboarding_completed.sql` adding `onboarding_completed_at TIMESTAMPTZ DEFAULT NULL` column to profiles table

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational blocking tasks needed — all user stories modify existing files independently

**Checkpoint**: Setup complete — user story implementation can begin

---

## Phase 3: User Story 1 — Settings Page Loads Reliably (Priority: P1) 🎯 MVP

**Goal**: Fix the Settings page blank-on-navigation bug so all sections render on SPA navigation without page reload

**Independent Test**: Navigate from Dashboard to Settings via the nav link and verify all sections (Profile, Security, Your Plan, Upgrade, Danger Zone) render within 2 seconds without a page reload

### Implementation for User Story 1

- [x] T003 [US1] Fix Settings page blank-on-navigation in `src/views/SettingsView.vue`: add a `watch` on `auth.profile` to reactively update `displayName` when profile data arrives after SPA navigation, and add a loading guard (skeleton or spinner) while `auth.loading` is true so the page shows a loading state instead of blank content
- [x] T004 [US1] Add unit test for Settings page loading behavior in `tests/unit/views/settings-view.test.js`: test that the component shows a loading state when profile is null, and reactively renders content when profile data becomes available

**Checkpoint**: Settings page renders correctly on all SPA navigation paths

---

## Phase 4: User Story 2 — Accurate and Consistent Pricing Information (Priority: P1)

**Goal**: Align all pricing copy on the landing page with actual plan limits so Free shows "3 endpoints / 6-hour retention" and Pro shows "5 EUR/month" with real features

**Independent Test**: Compare landing page pricing section with Settings page plan comparison — all limits and features must match exactly

### Implementation for User Story 2

- [x] T005 [US2] Update Free plan pricing card in `src/views/HomeView.vue`: change "Unlimited endpoints" to "3 endpoints", change "24-hour log retention" to "6-hour log retention", and ensure all other Free plan limits match the enforced values (30 req/min, 64KB body, 30s timeout)
- [x] T006 [US2] Update Pro plan pricing card in `src/views/HomeView.vue`: replace "TBD / Coming soon" with "5 EUR/month", list actual Pro features (25 endpoints, 7-day retention, 120 req/min, 1MB body, 55s timeout, replay, search, custom headers), and change the disabled CTA button to an active link routing to `/register`
- [x] T007 [US2] Verify plan limits consistency: cross-check that the landing page pricing (HomeView.vue), Settings page plan comparison (`src/components/settings/PlanComparison.vue`), and Endpoints page limit display all reference the same values

**Checkpoint**: All pricing information is consistent across landing page and app

---

## Phase 5: User Story 3 — Endpoint Limit Visibility and Upgrade Path (Priority: P1)

**Goal**: Free users clearly see their endpoint limit, usage count, and have a direct upgrade path when approaching or at the limit

**Independent Test**: On a Free plan account, view the Endpoints page and verify explanatory text appears next to the progress bar with an upgrade link

### Implementation for User Story 3

- [x] T008 [US3] Add limit explanation text next to the endpoint progress bar in `src/views/EndpointsView.vue`: display "Free plan: 3 endpoints" (or "Pro plan: 25 endpoints") with an "Upgrade to Pro" router-link to `/settings` for Free users
- [x] T009 [US3] Add upgrade CTA when at limit in `src/views/EndpointsView.vue`: when the user has reached their endpoint limit (e.g., 3/3), show a prominent message explaining the limit and a button linking to the upgrade section on Settings page, and disable the "Create Endpoint" button with a tooltip

**Checkpoint**: Free users understand their limits and have a clear upgrade path

---

## Phase 6: User Story 4 — Landing Page Navigation and CTAs (Priority: P2)

**Goal**: All CTA buttons and anchor links on the landing page work correctly, and auth page logos link home

**Independent Test**: Click every CTA button and nav link on the landing page and verify each navigates or scrolls to the correct destination. Click the logo on login/register pages and verify it goes to `/`

### Implementation for User Story 4

- [x] T010 [P] [US4] Wire CTA buttons in `src/views/HomeView.vue`: ensure "Start for free", "Get started free", and similar CTA buttons navigate to `/register` or scroll to the inline sign-in form using `document.getElementById().scrollIntoView({ behavior: 'smooth' })`
- [x] T011 [P] [US4] Fix anchor navigation links in `src/views/HomeView.vue`: ensure "How it works", "Features", and "Pricing" nav links scroll to their corresponding sections using `id` attributes and smooth scrolling
- [x] T012 [P] [US4] Make HookSpy logo a link to `/` on `src/views/LoginView.vue` and `src/views/RegisterView.vue`: wrap the logo image/text in a `router-link to="/"`

**Checkpoint**: All landing page navigation is functional and auth pages link back home

---

## Phase 7: User Story 5 — New User Onboarding After First Endpoint (Priority: P2)

**Goal**: After creating their first endpoint, new users see a guided tour overlay walking them through key next steps

**Independent Test**: Create a new account, create an endpoint, return to dashboard — a step-by-step guided tour overlay should appear highlighting: copy webhook URL, paste in provider, keep dashboard open, send test webhook

### Implementation for User Story 5

- [x] T013 [US5] Create onboarding composable `src/composables/use-onboarding.js`: export a `useOnboarding()` function that checks `auth.profile.onboarding_completed_at`, provides a `shouldShowTour` computed, and a `completeTour()` method that updates the profiles table via Supabase client (`profiles.update({ onboarding_completed_at: new Date().toISOString() }).eq('id', auth.user.id)`)
- [x] T014 [US5] Implement guided tour in `src/views/DashboardView.vue`: import driver.js and `useOnboarding`, trigger the tour when `shouldShowTour` is true and at least one endpoint exists, configure 4 steps: (1) highlight webhook URL with "Copy this URL" message, (2) "Paste it in your webhook provider (Stripe, GitHub, etc.)", (3) "Keep this dashboard open — it's your relay bridge", (4) "Send a test webhook and watch it appear here". On tour completion or dismissal, call `completeTour()`
- [x] T015 [US5] Add unit test for onboarding composable in `tests/unit/composables/use-onboarding.test.js`: test that `shouldShowTour` returns true when `onboarding_completed_at` is null, false when set, and that `completeTour()` calls the Supabase update

**Checkpoint**: New users get guided through their first webhook relay experience

---

## Phase 8: User Story 6 — Destructive Actions Require Confirmation (Priority: P2)

**Goal**: Endpoint deletion requires a confirmation modal, account deletion requires typing "DELETE" to confirm

**Independent Test**: Click Delete on an endpoint — confirmation modal appears. Click Delete Account — modal requires typing "DELETE" before the button enables

### Implementation for User Story 6

- [x] T016 [P] [US6] Add endpoint delete confirmation in `src/views/EndpointsView.vue`: use PrimeVue `useConfirm()` composable and add `<ConfirmDialog />` component. Before calling the delete API, call `confirm.require({ message: 'Are you sure you want to delete "[endpoint name]"? This action cannot be undone.', header: 'Delete Endpoint', acceptClass: 'p-button-danger', accept: () => deleteEndpoint(id) })`
- [x] T017 [P] [US6] Enhance account delete confirmation in `src/views/SettingsView.vue`: update the existing delete account dialog to require typing "DELETE" or their email to confirm. Add a `deleteConfirmText` ref, show instructions "Type DELETE or your email to confirm", and keep the delete button disabled until `deleteConfirmText === 'DELETE' || deleteConfirmText === auth.user?.email`. Display clear consequences: "This will permanently delete your account, all endpoints, and all webhook logs."

**Checkpoint**: All destructive actions are protected by confirmation dialogs

---

## Phase 9: User Story 7 — Registration and Auth UX Improvements (Priority: P2)

**Goal**: Registration shows password requirements, errors are user-friendly, and login has a forgot password link

**Independent Test**: Visit register page — password hints visible. Submit with used email — friendly error. Visit login page — "Forgot password?" link visible and functional

### Implementation for User Story 7

- [x] T018 [P] [US7] Add password requirements helper text in `src/views/RegisterView.vue`: below the password field, add small helper text "Password must be at least 8 characters" that appears when the password field is focused or has content
- [x] T019 [P] [US7] Map backend errors to user-friendly messages in `src/views/RegisterView.vue`: create an error mapping object (e.g., `'User already registered'` → `'This email is already registered. Try signing in instead.'`, default → `'Something went wrong. Please try again.'`) and apply it to the error display
- [x] T020 [P] [US7] Add "Forgot password?" link to `src/views/LoginView.vue`: add a link below the password field that triggers Supabase `client.auth.resetPasswordForEmail(email)` with a toast confirmation "If an account exists with this email, you'll receive a password reset link"

**Checkpoint**: Auth forms provide clear guidance and graceful error handling

---

## Phase 10: User Story 8 — Form Feedback and Input Polish (Priority: P2)

**Goal**: Settings forms show save confirmations, disabled fields are explained, port numbers display correctly

**Independent Test**: Save profile display name — success toast appears. View Change Password section — helper text explains requirements. View port field — shows "3000" not "3,000"

### Implementation for User Story 8

- [x] T021 [P] [US8] Add save confirmation toast in `src/views/SettingsView.vue`: after successful profile save, call `toast.add({ severity: 'success', summary: 'Profile Updated', detail: 'Your display name has been saved.', life: 3000 })`. On error, show `toast.add({ severity: 'error', summary: 'Save Failed', detail: error.message, life: 5000 })`
- [x] T022 [US8] Add Change Password helper text in `src/views/SettingsView.vue`: below the Change Password button, add small text "Enter your current password, new password (min 8 characters), and confirm to change." when any password field is empty. Show `passwordError` inline when validation fails
- [x] T023 [US8] Add disabled email field explanation in `src/views/SettingsView.vue`: below the email InputText, add `<small class="text-surface-500">Email cannot be changed</small>`
- [x] T024 [P] [US8] Fix port number formatting in `src/components/endpoints/EndpointForm.vue`: add `:use-grouping="false"` prop to the port `InputNumber` component to prevent locale thousand separators (displays "3000" instead of "3,000")
- [x] T025 [P] [US8] Fix port number formatting in `src/components/endpoints/EndpointEditDialog.vue`: add `:use-grouping="false"` prop to the port `InputNumber` component (same fix as T024)

**Checkpoint**: All forms provide clear feedback and display values correctly

---

## Phase 11: User Story 9 — Connection Status and Log Empty States (Priority: P2)

**Goal**: Show "Connecting..." during WebSocket initialization, improve log empty states with guidance, align retention messaging

**Independent Test**: Load dashboard — status shows "Connecting..." before "Connected". Visit Logs with no data — helpful guidance text and curl example appear

### Implementation for User Story 9

- [x] T026 [P] [US9] Add "Connecting..." state to `src/components/relay/RelayStatus.vue`: in the `statusConfig` computed, add a check before the default case — if relay status is not `active` and not `no-endpoints`, and the transport mode is still initializing (null/unknown), show `{ dotClass: 'status-dot bg-blue-400 status-dot-pulse', label: 'Connecting...', pillClass: 'bg-blue-50 text-blue-700 border-blue-200' }` instead of "Disconnected"
- [x] T027 [P] [US9] Improve webhook log empty state in `src/views/LogsView.vue`: replace the minimal "No webhook logs yet" text with guidance: "Logs will appear here when webhooks hit your endpoints." followed by a "Quick test" section with a copyable curl command example: `curl -X POST https://www.hookspy.dev/api/hook/YOUR_SLUG -H "Content-Type: application/json" -d '{"test": true}'`
- [x] T028 [P] [US9] Align retention messaging: ensure the retention banner on the Logs page matches the landing page and Settings page (Free: "6 hours", Pro: "7 days"). Check for any hardcoded retention values and update to match plan config

**Checkpoint**: Connection status is accurate and empty states provide actionable guidance

---

## Phase 12: User Story 10 — Mobile Experience Improvements (Priority: P2)

**Goal**: Mobile users can view full webhook URLs, see account info in the hamburger menu, and navigate the landing page

**Independent Test**: On a mobile viewport — webhook URLs are scrollable, hamburger menu shows email and plan badge, landing page has mobile navigation

### Implementation for User Story 10

- [x] T029 [P] [US10] Make webhook URLs scrollable on mobile in `src/components/endpoints/EndpointCard.vue` and `src/views/EndpointDetailView.vue`: wrap the URL display in a container with `overflow-x-auto whitespace-nowrap` Tailwind classes so users can scroll to see the full URL on small screens
- [x] T030 [P] [US10] Add user info to mobile hamburger menu in `src/components/layout/AppHeader.vue`: in the mobile menu section (after the menu opens), add a user info block at the top showing `auth.user?.email` (truncated with `truncate` class) and the `<PlanBadge />` component (already imported) before the nav links
- [x] T031 [P] [US10] Add mobile navigation to landing page in `src/views/HomeView.vue`: add a hamburger menu button visible on small screens (`md:hidden`) that toggles a mobile nav overlay with links to "How it works", "Features", "Pricing", and "Sign in" — matching the desktop nav but in a mobile-friendly dropdown/sheet format

**Checkpoint**: Mobile users have full access to all navigation and can view complete URLs

---

## Phase 13: User Story 11 — Dashboard and UI Polish (Priority: P3)

**Goal**: Small polish items — clickable endpoint names, duplicate action, Pro filter tooltips, dark mode verification

**Independent Test**: Verify each item independently — click endpoint name on dashboard (navigates to detail), use duplicate action, click Pro filter as Free user (tooltip appears)

### Implementation for User Story 11

- [x] T032 [P] [US11] Make endpoint names clickable on Dashboard in `src/views/DashboardView.vue`: wrap endpoint name text in a `<router-link :to="'/endpoints/' + endpoint.id">` so it navigates to the endpoint detail page
- [x] T033 [P] [US11] Add "Duplicate" endpoint action in `src/views/EndpointsView.vue`: add a "Duplicate" button/menu item alongside Edit and Delete. On click, open the create endpoint form pre-filled with the selected endpoint's configuration (name with " (copy)" suffix, same host, port, path, timeout, headers) but generate a new slug
- [x] T034 [P] [US11] Add upgrade tooltip on Pro-only log filters in `src/components/logs/LogFilters.vue`: when a Free user clicks a disabled Pro filter (Search, Method), show a PrimeVue Tooltip or small popover: "Upgrade to Pro to use advanced filters" with a link to `/settings`
- [x] T035 [US11] Verify dark mode persistence across sessions: confirm that `AppHeader.vue` already reads `localStorage.getItem('hs-dark-mode')` on mount and writes on toggle. If working correctly, mark FR-029 as already implemented with no code changes needed

**Checkpoint**: All polish items verified — full UX improvement suite complete

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all user stories

- [x] T036 Run all existing tests (`npm run test`) and fix any regressions introduced by UX changes
- [x] T037 Run linter (`npm run lint`) and formatter (`npm run format`) to ensure code quality across all modified files
- [x] T038 Manual cross-story verification: navigate the full user journey (landing page → register → create endpoint → dashboard → logs → settings → mobile) and verify all 29 functional requirements are met
- [x] T039 Verify Vercel deployment stays within 12 serverless function limit (no new API endpoints added — should remain at 11)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: No blocking tasks needed
- **User Stories (Phases 3–13)**: All depend on Setup (Phase 1) completion only
  - US5 (Onboarding) depends on T002 (migration) from Setup
  - All other user stories have no setup dependencies
- **Polish (Phase 14)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Settings page fix — independent, no cross-story dependencies
- **US2 (P1)**: Pricing alignment — independent
- **US3 (P1)**: Endpoint limits — independent
- **US4 (P2)**: Landing CTAs — independent (touches HomeView.vue like US2, coordinate file edits)
- **US5 (P2)**: Onboarding — depends on T002 (migration), otherwise independent
- **US6 (P2)**: Delete confirmations — independent
- **US7 (P2)**: Auth UX — independent
- **US8 (P2)**: Form feedback — independent
- **US9 (P2)**: Connection status — independent
- **US10 (P2)**: Mobile — independent (touches AppHeader.vue, HomeView.vue — coordinate)
- **US11 (P3)**: Polish — independent

### File Coordination Notes

Several user stories touch the same files. When implementing sequentially, these are fine. If implementing in parallel, coordinate:

- **HomeView.vue**: US2 (pricing), US4 (CTAs/anchors), US10 (mobile nav) — recommend implementing US2 → US4 → US10 sequentially for this file
- **SettingsView.vue**: US1 (loading), US6 (delete confirm), US8 (form feedback) — recommend US1 → US8 → US6 sequentially
- **EndpointsView.vue**: US3 (limits), US6 (delete confirm), US11 (duplicate) — recommend US3 → US6 → US11 sequentially

### Parallel Opportunities

Within each user story, tasks marked [P] can run in parallel:

- **US4**: T010, T011, T012 are on different files/sections
- **US7**: T018, T019, T020 are on different files
- **US8**: T021–T025 are all on different files
- **US9**: T026, T027, T028 are on different files/components
- **US10**: T029, T030, T031 are on different files
- **US11**: T032, T033, T034 are on different files

---

## Parallel Example: User Story 8 (Form Feedback)

```text
# All 5 tasks can run in parallel (different files):
T021: Save toast in SettingsView.vue
T022: Password helper in SettingsView.vue (same file as T021 — run after T021)
T023: Email helper in SettingsView.vue (same file — run after T022)
T024: Port fix in EndpointForm.vue
T025: Port fix in EndpointEditDialog.vue

# Effective parallel groups:
Group A: T024, T025 (different files, parallel)
Group B: T021 → T022 → T023 (same file, sequential)
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 3: US1 — Settings page fix (T003–T004)
3. Complete Phase 4: US2 — Pricing alignment (T005–T007)
4. Complete Phase 5: US3 — Endpoint limits (T008–T009)
5. **STOP and VALIDATE**: All P1 items fixed — core trust and revenue paths unblocked
6. Deploy

### Incremental Delivery

1. **P1 Sprint**: US1 + US2 + US3 → fixes revenue-blocking issues
2. **P2 Sprint A**: US4 + US5 + US6 → navigation, onboarding, safety
3. **P2 Sprint B**: US7 + US8 + US9 → auth, forms, status
4. **P2 Sprint C**: US10 → mobile experience
5. **P3 Sprint**: US11 → polish items
6. **Final**: Phase 14 — cross-cutting validation

### Single Developer Strategy (Recommended)

Execute phases 1–14 sequentially in order. Within each user story, implement tasks in listed order. This avoids all file coordination issues and ensures each story is complete before moving on.

---

## Summary

| Metric              | Value                                          |
| ------------------- | ---------------------------------------------- |
| Total tasks         | 39                                             |
| Setup tasks         | 2                                              |
| P1 tasks (US1–US3)  | 7                                              |
| P2 tasks (US4–US10) | 19                                             |
| P3 tasks (US11)     | 4                                              |
| Polish tasks        | 4                                              |
| New files created   | 3 (migration, use-onboarding.js, 2 test files) |
| Files modified      | ~15 existing Vue components                    |
| New dependencies    | 1 (driver.js)                                  |
| New API endpoints   | 0                                              |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Dark mode (FR-029) is already implemented — T035 is verification only
- No tests requested in spec — tests included only for US1 (Settings loading) and US5 (onboarding composable) due to behavioral complexity
- Commit after each user story phase completion
- `npm install --legacy-peer-deps` required for driver.js installation
