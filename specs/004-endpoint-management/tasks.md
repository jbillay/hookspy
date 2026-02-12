# Tasks: Endpoint Management

**Input**: Design documents from `/specs/004-endpoint-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/endpoints-api.md

**Tests**: Included — spec requires meaningful testing per Constitution IV.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared helpers and foundational plumbing needed by all user stories

- [x] T001 Create CORS helper with setCorsHeaders and OPTIONS handling in api/\_lib/cors.js
- [x] T002 Create Pinia endpoints store with state (endpoints, loading, error), fetchEndpoints, createEndpoint, updateEndpoint, deleteEndpoint methods in src/stores/endpoints.js
- [x] T003 Create useEndpoints composable (thin wrapper around endpoints store) in src/composables/use-endpoints.js

**Checkpoint**: Shared infrastructure ready — user story implementation can begin

---

## Phase 2: User Story 1 — Create Endpoint (Priority: P1) 🎯 MVP

**Goal**: User creates a webhook endpoint with auto-generated slug and sees it in the list

**Independent Test**: Create an endpoint via the form, verify it appears in the list with a copyable webhook URL

### Tests for User Story 1

- [x] T004 [P] [US1] Write unit tests for endpoints store (fetchEndpoints, createEndpoint) in tests/unit/stores/endpoints.test.js
- [x] T005 [P] [US1] Write unit tests for POST /api/endpoints and GET /api/endpoints in tests/unit/api/endpoints.test.js

### Implementation for User Story 1

- [x] T006 [US1] Implement API handler for GET (list) and POST (create) with auth, CORS, validation, and slug generation in api/endpoints/index.js
- [x] T007 [US1] Create EndpointForm.vue component with fields: name, target_url, target_port, target_path, timeout_seconds and client-side validation in src/components/endpoints/EndpointForm.vue
- [x] T008 [US1] Create EndpointCard.vue component displaying name, webhook URL with copy button, status badge, target summary, and last activity in src/components/endpoints/EndpointCard.vue
- [x] T009 [US1] Create EndpointsView.vue with endpoint list (cards), empty state CTA, and "New Endpoint" button in src/views/EndpointsView.vue
- [x] T010 [US1] Create EndpointDetailView.vue that detects create vs edit mode (/endpoints/new vs /endpoints/:id) and renders EndpointForm in src/views/EndpointDetailView.vue
- [x] T011 [US1] Add routes for /endpoints (EndpointsView), /endpoints/new (EndpointDetailView), /endpoints/:id (EndpointDetailView) in src/router/index.js
- [x] T012 [US1] Add "Endpoints" navigation link to AppHeader in src/components/layout/AppHeader.vue

**Checkpoint**: User can create endpoints and see them listed with copyable webhook URLs

---

## Phase 3: User Story 2 — Edit Endpoint (Priority: P1)

**Goal**: User edits an existing endpoint's configuration and changes persist

**Independent Test**: Edit an endpoint's target port, save, verify the change persists

### Tests for User Story 2

- [x] T013 [P] [US2] Write unit tests for GET/PUT /api/endpoints/:id in tests/unit/api/endpoints.test.js (append to existing)
- [x] T014 [P] [US2] Write unit tests for updateEndpoint store method in tests/unit/stores/endpoints.test.js (append to existing)

### Implementation for User Story 2

- [x] T015 [US2] Implement API handler for GET (single), PUT (update), and DELETE (delete) with auth, ownership check, CORS, and validation in api/endpoints/[id].js
- [x] T016 [US2] Wire EndpointDetailView edit mode to load existing endpoint data and submit PUT via store in src/views/EndpointDetailView.vue
- [x] T017 [US2] Add edit button/link to EndpointCard that navigates to /endpoints/:id in src/components/endpoints/EndpointCard.vue

**Checkpoint**: User can edit any endpoint field and see changes persist

---

## Phase 4: User Story 4 — Delete Endpoint (Priority: P1)

**Goal**: User deletes an endpoint with confirmation, and associated logs are cascade-deleted

**Independent Test**: Delete an endpoint, verify it disappears from the list

### Tests for User Story 4

- [x] T018 [P] [US4] Write unit tests for DELETE /api/endpoints/:id in tests/unit/api/endpoints.test.js (append to existing)
- [x] T019 [P] [US4] Write unit tests for deleteEndpoint store method in tests/unit/stores/endpoints.test.js (append to existing)

### Implementation for User Story 4

- [x] T020 [US4] Add delete button to EndpointCard with PrimeVue ConfirmDialog integration in src/components/endpoints/EndpointCard.vue
- [x] T021 [US4] Add ConfirmDialog component to App.vue and register ConfirmationService in src/main.js

**Checkpoint**: User can delete endpoints with confirmation; cascade deletes logs

---

## Phase 5: User Story 3 — Header Injection (Priority: P2)

**Goal**: User adds/removes custom key-value headers on an endpoint

**Independent Test**: Add header `X-Api-Key: secret123`, save, verify it persists

### Tests for User Story 3

- [x] T022 [P] [US3] Write unit tests for HeaderInjectionEditor component (add/remove/validate) in tests/unit/components/endpoints/header-injection-editor.test.js

### Implementation for User Story 3

- [x] T023 [US3] Create HeaderInjectionEditor.vue with dynamic key-value rows, add/remove buttons, and empty-key validation in src/components/endpoints/HeaderInjectionEditor.vue
- [x] T024 [US3] Integrate HeaderInjectionEditor into EndpointForm (bind to custom_headers as JSONB object) in src/components/endpoints/EndpointForm.vue

**Checkpoint**: User can configure custom headers that are persisted as JSONB

---

## Phase 6: User Story 5 — Toggle Active/Inactive (Priority: P2)

**Goal**: User toggles endpoint between active and inactive states inline

**Independent Test**: Toggle to inactive, verify UI reflects change

### Tests for User Story 5

- [x] T025 [P] [US5] Write unit test for toggleActive store method in tests/unit/stores/endpoints.test.js (append to existing)

### Implementation for User Story 5

- [x] T026 [US5] Add toggleActive method to endpoints store (calls updateEndpoint with is_active flip) in src/stores/endpoints.js
- [x] T027 [US5] Add PrimeVue ToggleSwitch to EndpointCard with optimistic update and error rollback in src/components/endpoints/EndpointCard.vue

**Checkpoint**: User can toggle endpoint active/inactive from the list view

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across all user stories

- [x] T028 Run all tests and ensure they pass: npm run test
- [x] T029 Run lint and fix any issues: npm run lint:fix
- [x] T030 Run format check and fix: npm run format
- [x] T031 Run quickstart.md manual validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1 Create)**: Depends on Phase 1 — delivers MVP
- **Phase 3 (US2 Edit)**: Depends on Phase 2 (needs API [id].js handler, EndpointCard, EndpointDetailView)
- **Phase 4 (US4 Delete)**: Depends on Phase 3 (needs API [id].js handler from US2)
- **Phase 5 (US3 Headers)**: Depends on Phase 2 (needs EndpointForm)
- **Phase 6 (US5 Toggle)**: Depends on Phase 2 (needs EndpointCard and store)
- **Phase 7 (Polish)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (Create)**: Foundation — no story dependencies
- **US2 (Edit)**: Depends on US1 (shares EndpointDetailView, EndpointForm, API [id].js)
- **US3 (Headers)**: Depends on US1 (needs EndpointForm to integrate into)
- **US4 (Delete)**: Depends on US2 (needs API [id].js handler)
- **US5 (Toggle)**: Depends on US1 (needs EndpointCard and store)

### Parallel Opportunities

- **Phase 1**: T002 and T003 depend on each other; T001 is independent
- **Phase 2**: T004 and T005 can run in parallel (different test files)
- **After US1**: US3 (Headers) and US5 (Toggle) can run in parallel (different components)
- **Within each phase**: Test tasks marked [P] can run in parallel with each other

---

## Parallel Example: Phase 2 (User Story 1)

```bash
# Tests first (parallel):
Task: "Write store tests" (tests/unit/stores/endpoints.test.js)
Task: "Write API tests" (tests/unit/api/endpoints.test.js)

# Then implementation (sequential due to dependencies):
Task: "API handler" (api/endpoints/index.js)
Task: "EndpointForm component" (src/components/endpoints/EndpointForm.vue)
Task: "EndpointCard component" (src/components/endpoints/EndpointCard.vue)
Task: "EndpointsView" (src/views/EndpointsView.vue)
Task: "EndpointDetailView" (src/views/EndpointDetailView.vue)
Task: "Router + nav" (src/router/index.js, AppHeader.vue)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: US1 Create (T004–T012)
3. **STOP and VALIDATE**: Create an endpoint, verify list + copy URL
4. Deploy/demo if ready

### Incremental Delivery

1. Setup → Foundation ready
2. US1 Create → MVP! Endpoints can be created and listed
3. US2 Edit → Endpoints are fully editable
4. US4 Delete → Endpoints can be removed
5. US3 Headers → Custom header injection available
6. US5 Toggle → Quick active/inactive switching
7. Polish → All quality checks pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are included per Constitution IV (Meaningful Testing)
- EndpointForm.vue is shared between create (US1) and edit (US2) modes
- API [id].js handler is created in US2 phase but also serves US4 (delete)
- Commit after each phase checkpoint
