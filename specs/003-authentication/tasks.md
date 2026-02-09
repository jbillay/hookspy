# Tasks: Authentication

**Input**: Design documents from `/specs/003-authentication/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/auth-api.md

**Tests**: Included — spec references Vitest testing and constitution mandates meaningful test coverage.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Ensure environment is ready for auth implementation

- [x] T001 Create `.env` file with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` placeholders (copy from Supabase dashboard)
- [x] T002 Verify Supabase Auth email provider is enabled in Supabase dashboard (email confirmation disabled)

**Checkpoint**: Environment configured — auth implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create Pinia auth store with reactive state (`user`, `session`, `loading`), `initAuth` action (calls `getSession()` + subscribes to `onAuthStateChange`), `signIn`, `signUp`, `signOut` actions, and `isAuthenticated` getter in `src/stores/auth.js`
- [x] T004 Create `useAuth` composable that imports and returns the auth store for component consumption in `src/composables/use-auth.js`
- [x] T005 Create server-side JWT verification helper `verifyAuth(req)` that extracts Bearer token from Authorization header and calls `supabase.auth.getUser(token)` in `api/_lib/auth.js`
- [x] T006 Update `src/main.js` to import the auth store and call `initAuth()` before mounting the app (ensure auth state is loaded from localStorage on startup)
- [x] T007 Create placeholder `DashboardView.vue` in `src/views/DashboardView.vue` with a simple "Welcome to HookSpy" message and the user's email displayed
- [x] T008 Add routes for `/login`, `/register`, and `/dashboard` to `src/router/index.js` (import LoginView, RegisterView, DashboardView); update home route `/` to redirect to `/dashboard` if authenticated or `/login` if not
- [x] T009 Add `beforeEach` navigation guard to `src/router/index.js` that checks `authStore.isAuthenticated` and redirects unauthenticated users to `/login?redirect=<intended-path>` for all routes except `/login`, `/register`, and `/`

**Checkpoint**: Foundation ready — auth store initialized on app load, routes protected, server-side verification available

---

## Phase 3: User Story 1 — User Registers an Account (Priority: P1) MVP

**Goal**: New users can create an account with email/password and be redirected to the dashboard

**Independent Test**: Navigate to `/register`, fill in valid email + password + confirm password, submit, verify redirect to dashboard with authenticated state

### Implementation for User Story 1

- [x] T010 [US1] Create `RegisterView.vue` in `src/views/RegisterView.vue` with PrimeVue form: InputText for email, Password for password, Password for confirm password, Button for submit. Include client-side validation (email format, password min 6 chars, passwords match). Show validation errors inline. Disable submit button + show loading spinner during request (FR-012). On success redirect to `/dashboard`. On error show toast notification with user-friendly message (map "User already registered" to "This email is already registered"). Include "Already have an account? Sign in" link to `/login`

### Tests for User Story 1

- [x] T011 [P] [US1] Write unit tests for auth store `signUp` action in `tests/unit/stores/auth.test.js` — test successful signup sets user/session, test error returns error message, test loading state toggles during request

**Checkpoint**: User Story 1 complete — registration flow works end-to-end

---

## Phase 4: User Story 2 — User Logs In (Priority: P1)

**Goal**: Existing users can log in with email/password and be redirected to the dashboard (or originally requested page)

**Independent Test**: Navigate to `/login`, enter valid credentials, submit, verify redirect to dashboard. Also test: navigate to protected route while logged out, get redirected to `/login?redirect=...`, login, verify redirect back to original route

### Implementation for User Story 2

- [x] T012 [US2] Create `LoginView.vue` in `src/views/LoginView.vue` with PrimeVue form: InputText for email, Password for password, Button for submit. Disable submit button + show loading spinner during request (FR-012). On success redirect to `route.query.redirect` or `/dashboard` (FR-013). On error show toast notification "Invalid email or password". Include "Create an account" link to `/register`

### Tests for User Story 2

- [x] T013 [P] [US2] Write unit tests for auth store `signIn` action in `tests/unit/stores/auth.test.js` — test successful login sets user/session, test invalid credentials returns error, test loading state toggles during request

**Checkpoint**: User Story 2 complete — login flow works end-to-end with redirect-back

---

## Phase 5: User Story 3 — User Logs Out (Priority: P1)

**Goal**: Authenticated users can log out via the header button and be redirected to the login page

**Independent Test**: While logged in, click logout button in header, verify session cleared and redirect to `/login`. Navigate to any protected route, verify redirect to `/login`

### Implementation for User Story 3

- [x] T014 [US3] Create `AppHeader.vue` in `src/components/layout/AppHeader.vue` showing the app name "HookSpy" on the left and the authenticated user's email + a logout Button on the right. Logout button calls `authStore.signOut()` and router pushes to `/login`. Use PrimeVue Button and Tailwind for layout
- [x] T015 [US3] Update `AppLayout.vue` in `src/components/layout/AppLayout.vue` to include `AppHeader` above the slot content, but only show it when the user is authenticated (hide on login/register pages). Use the auth store to check authentication state. Use route meta or path check to determine if header should show

### Tests for User Story 3

- [x] T016 [P] [US3] Write unit tests for auth store `signOut` action in `tests/unit/stores/auth.test.js` — test signOut clears user/session state, test loading state during signout

**Checkpoint**: User Story 3 complete — logout works, header displays user state

---

## Phase 6: User Story 4 — Session Persistence (Priority: P2)

**Goal**: Authenticated sessions persist across browser restarts; unauthenticated users are redirected to login

**Independent Test**: Log in, close browser tab, reopen app, verify session restored and dashboard displayed without re-authentication

### Implementation for User Story 4

- [x] T017 [US4] Verify and refine `initAuth` in `src/stores/auth.js` to properly handle the `INITIAL_SESSION` event from `onAuthStateChange` — ensure the store's `loading` state transitions from `true` to `false` after initial session check completes, and that the router guard waits for auth initialization before redirecting (prevent flash of login page)
- [x] T018 [US4] Update `src/router/index.js` navigation guard to await auth store initialization (check `loading` state) before making redirect decisions — if still loading, wait for auth to initialize before allowing or blocking navigation

### Tests for User Story 4

- [x] T019 [P] [US4] Write unit tests for auth store `initAuth` action in `tests/unit/stores/auth.test.js` — test session restored from getSession, test onAuthStateChange subscription updates store state, test loading transitions correctly

**Checkpoint**: User Story 4 complete — sessions persist across browser restarts

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements, additional tests, and validation

- [x] T020 [P] Write unit tests for `useAuth` composable in `tests/unit/composables/use-auth.test.js` — test it returns auth store properties and actions
- [x] T021 [P] Write unit tests for server-side `verifyAuth` helper in `tests/unit/api/auth.test.js` — test valid token returns user, test missing header returns error, test invalid token returns error
- [x] T022 Update `HomeView.vue` in `src/views/HomeView.vue` to wire up the "Get Started" button to navigate to `/register` (or `/dashboard` if already authenticated)
- [x] T023 Run `npm run lint` and fix any ESLint errors across all new/modified files
- [x] T024 Run `npm run format` to ensure Prettier formatting on all new/modified files
- [x] T025 Run `npm run test` and verify all auth tests pass
- [x] T026 Run quickstart.md validation: manual walkthrough of all verification steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phase 2 (independent of US1)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (independent of US1/US2)
- **User Story 4 (Phase 6)**: Depends on Phase 2 (refines foundation, independent of US1-3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Register)**: Needs auth store + routes → can start after Phase 2
- **US2 (Login)**: Needs auth store + routes → can start after Phase 2 (parallel with US1)
- **US3 (Logout)**: Needs auth store → can start after Phase 2 (parallel with US1/US2)
- **US4 (Session Persistence)**: Needs auth store initAuth refinement → can start after Phase 2 (parallel with US1-3)

### Within Each User Story

- Implementation tasks before tests (tests validate the implementation)
- UI components depend on store/composable (Phase 2)

### Parallel Opportunities

- **Phase 2**: T003 and T005 can run in parallel (store vs server-side helper). T007 can run in parallel with T003-T006.
- **Phase 3-6**: All four user stories can run in parallel after Phase 2 completes (different files, independent flows)
- **Phase 7**: T020 and T021 can run in parallel (different test files)

---

## Parallel Example: After Phase 2

```bash
# All user stories can be implemented in parallel:
Task: "[US1] Create RegisterView.vue"         # src/views/RegisterView.vue
Task: "[US2] Create LoginView.vue"             # src/views/LoginView.vue
Task: "[US3] Create AppHeader.vue"             # src/components/layout/AppHeader.vue
Task: "[US4] Refine initAuth in auth store"    # src/stores/auth.js (non-conflicting section)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup (env vars)
2. Complete Phase 2: Foundational (auth store, composable, server helper, routes, guards)
3. Complete Phase 3: Register (US1)
4. Complete Phase 4: Login (US2)
5. Complete Phase 5: Logout (US3)
6. **STOP and VALIDATE**: Test register → dashboard → logout → login flow end-to-end
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Register) → Test independently → First users can sign up
3. Add US2 (Login) → Test independently → Returning users can log in
4. Add US3 (Logout) → Test independently → Full auth cycle complete (MVP!)
5. Add US4 (Session Persistence) → Test independently → Polish
6. Polish phase → All tests pass, lint clean, quickstart validated

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Auth store tests (T011, T013, T016, T019) all write to the same test file `tests/unit/stores/auth.test.js` — they should be executed sequentially (each adds test cases to the file)
- Supabase client mock needed for all tests — mock `@supabase/supabase-js` in test setup
- PrimeVue Toast is used for error notifications — import `useToast` from `primevue/usetoast` in views
- Commit after each completed phase or user story
