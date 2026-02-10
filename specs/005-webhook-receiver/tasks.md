# Tasks: Webhook Receiver

**Input**: Design documents from `/specs/005-webhook-receiver/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per Constitution Principle IV (Meaningful Testing) — tests cover serverless function logic, auth enforcement, and HTTP status codes.

**Organization**: Tasks grouped by user story. US2 (All HTTP Methods) and US3 (Full Header/Body Preservation) are inherent to the US1 webhook receiver implementation and are folded into US1 with explicit acceptance validation. US4 (Response Submission) is a separate phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No new project setup needed — existing project with all infrastructure in place. Verify prerequisites.

- [x] T001 Verify database schema has `webhook_logs` and `endpoints` tables with correct columns by reviewing `supabase/migrations/20260209000001_create_tables.sql`
- [x] T002 Verify existing helpers are compatible: read `api/_lib/supabase.js`, `api/_lib/auth.js`, `api/_lib/cors.js` and confirm exports match expected usage

**Checkpoint**: Prerequisites confirmed — foundational work can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities needed by both the webhook receiver and response submission endpoints

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create directory structure: `api/logs/[id]/` for the response submission endpoint
- [x] T004 Update CORS helper to include PATCH and HEAD methods in `Access-Control-Allow-Methods` in `api/_lib/cors.js` (currently missing HEAD needed for webhook receiver)

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Webhook Receiver (Priority: P1) 🎯 MVP

**Goal**: External systems can send webhooks to `/api/hook/:slug`. The serverless function stores the request, polls for a browser-submitted response, and returns it — preserving full HTTP fidelity (method, headers, body, query string) for all HTTP methods.

**Covers**: US1 (Core Relay), US2 (All HTTP Methods), US3 (Full Header/Body Preservation)

**Independent Test**: Send HTTP POST to `/api/hook/:slug` with a JSON body and custom headers. Verify the log is created with exact data. Simulate a browser response by updating the log directly in the database. Verify the function returns the exact response to the caller.

### Tests for User Story 1

> **NOTE: Write tests FIRST, ensure they FAIL before implementation**

- [x] T005 [US1] Create webhook receiver test file at `tests/unit/api/hook-slug.test.js` with test cases:
  - Active endpoint: log created with correct `request_method`, `request_url`, `request_headers`, `request_body`
  - All HTTP methods (GET, POST, PUT, PATCH, DELETE) stored with correct `request_method` (US2)
  - Full headers and body preserved without transformation (US3)
  - Query string preserved in `request_url` (US3)
  - Inactive endpoint returns 404 with `{"error": "Endpoint not found"}`
  - Non-existent slug returns 404
  - Body > 1MB returns 413 with `{"error": "Payload Too Large"}`
  - Rate limit exceeded returns 429 with `{"error": "Too Many Requests"}`
  - Polling loop returns stored response when status becomes `responded`
  - Polling loop returns 504 when timeout exceeded, log status updated to `timeout`
  - Polling loop continues through `forwarding` status
  - Status `error` during polling returns 502 with error message
  - CORS headers set on all responses

### Implementation for User Story 1

- [x] T006 [US1] Implement webhook receiver in `api/hook/[slug].js`:
  - Export `config` with `api.bodyParser: false` and `maxDuration: 60`
  - Read raw request body from stream with 1MB size check
  - Look up endpoint by slug where `is_active = true` using service role Supabase client
  - Return 404 if endpoint not found or inactive
  - Implement in-memory rate limiting (Map keyed by slug + minute window, 60 req/min)
  - Return 429 if rate limit exceeded
  - Capture `request_method`, `request_url` (with query string), `request_headers` (all as JSON), `request_body` (raw)
  - Insert `webhook_logs` record with status `pending` and `received_at: now()`
  - Implement polling loop with `setTimeout`-based async wait (500ms interval)
  - On `responded` status: return `response_status`, `response_headers`, `response_body` to caller
  - On `error` status: return 502 with stored `error_message`
  - On timeout (`elapsed > endpoint.timeout_seconds`): update log to `timeout`, return 504
  - Continue polling through `pending` and `forwarding` statuses
  - Set CORS headers via `handleCors` from `api/_lib/cors.js`

- [x] T007 [US1] Run webhook receiver tests and verify all pass: `npm run test -- tests/unit/api/hook-slug.test.js`

**Checkpoint**: Webhook receiver fully functional — external systems can send requests and receive relayed responses (or timeouts). All HTTP methods supported, full fidelity preserved.

---

## Phase 4: User Story 4 — Response Submission (Priority: P1)

**Goal**: Browser relay can submit local server responses (or errors) back to the serverless function via a dedicated authenticated endpoint.

**Independent Test**: Insert a pending webhook log directly, POST a response to `/api/logs/:id/response` with a valid JWT, and verify the log status changes to `responded` with correct response data.

### Tests for User Story 4

> **NOTE: Write tests FIRST, ensure they FAIL before implementation**

- [x] T008 [US4] Create response submission test file at `tests/unit/api/log-response.test.js` with test cases:
  - Success: pending log updated to `responded` with `response_status`, `response_headers`, `response_body`, `responded_at`, `duration_ms`
  - Error report: pending log updated to `error` with `error_message`, `responded_at`, `duration_ms`
  - Missing auth returns 401
  - Invalid token returns 401
  - User doesn't own endpoint returns 403
  - Log not found returns 404
  - Non-POST method returns 405
  - Already resolved log (responded/timeout/error) returns 409 with `{"error": "Log already resolved"}`
  - Missing required fields returns 400
  - CORS headers set on all responses
  - OPTIONS preflight handled correctly

### Implementation for User Story 4

- [x] T009 [US4] Implement response submission endpoint in `api/logs/[id]/response.js`:
  - Handle CORS preflight (OPTIONS) via `handleCors`
  - Reject non-POST methods with 405
  - Verify JWT auth via `verifyAuth` from `api/_lib/auth.js`
  - Query webhook log by ID, joining with endpoints to get `user_id`
  - Return 404 if log not found
  - Verify authenticated user's ID matches endpoint's `user_id`, return 403 if not
  - Check log status is `pending` or `forwarding`, return 409 if already resolved
  - If request body contains `error` field:
    - Update log: `status = 'error'`, `error_message = body.error`, `responded_at = now()`, calculate `duration_ms`
  - If request body contains `status`, `headers`, `body` fields:
    - Update log: `status = 'responded'`, `response_status`, `response_headers`, `response_body`, `responded_at = now()`, calculate `duration_ms`
  - Otherwise return 400 with validation error
  - Return 200 with `{ success: true, log_id, status, duration_ms }`

- [x] T010 [US4] Run response submission tests and verify all pass: `npm run test -- tests/unit/api/log-response.test.js`

**Checkpoint**: Response submission working — browser relay can post responses and errors. Combined with US1, the full relay round-trip is functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T011 Run full test suite: `npm run test`
- [x] T012 Run linting and fix any issues: `npm run lint:fix`
- [x] T013 Run formatting and fix any issues: `npm run format`
- [x] T014 Verify both endpoints work together end-to-end: send webhook to `/api/hook/:slug`, submit response to `/api/logs/:id/response`, verify original caller receives the response

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verification only
- **Foundational (Phase 2)**: Depends on Setup confirmation
- **US1 Webhook Receiver (Phase 3)**: Depends on Foundational phase completion
- **US4 Response Submission (Phase 4)**: Depends on Foundational phase completion — can run in parallel with US1
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Webhook Receiver)**: Can start after Foundational (Phase 2) — No dependencies on US4
- **US4 (Response Submission)**: Can start after Foundational (Phase 2) — No dependencies on US1
- US1 and US4 are independently testable and can be implemented in parallel

### Within Each User Story

- Tests written first and verified to fail
- Implementation follows tests
- Test verification after implementation
- Story complete before moving to Polish

### Parallel Opportunities

- T001 and T002 can run in parallel (both verification)
- T003 and T004 can run in parallel (different files)
- T005 and T008 can run in parallel (different test files, different stories)
- T006 and T009 can run in parallel (different implementation files, different stories)
- T011, T012, T013 can run in parallel (independent checks)

---

## Parallel Example: US1 + US4 Simultaneous Implementation

```bash
# After Phase 2 completes, both stories can start simultaneously:

# Stream A: Webhook Receiver (US1)
Task: "T005 - Write webhook receiver tests in tests/unit/api/hook-slug.test.js"
Task: "T006 - Implement webhook receiver in api/hook/[slug].js"
Task: "T007 - Run and verify webhook receiver tests"

# Stream B: Response Submission (US4) — runs in parallel with Stream A
Task: "T008 - Write response submission tests in tests/unit/api/log-response.test.js"
Task: "T009 - Implement response submission in api/logs/[id]/response.js"
Task: "T010 - Run and verify response submission tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Foundational (CORS update, directory creation)
3. Complete Phase 3: US1 Webhook Receiver (with tests)
4. **STOP and VALIDATE**: Test webhook receiver independently (will timeout since no relay, but stores requests correctly)
5. Proceed to US4 for full round-trip

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 Webhook Receiver → External systems can send webhooks (timeout without relay) → MVP!
3. US4 Response Submission → Full relay round-trip functional
4. Polish → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US2 and US3 are folded into US1 since they describe acceptance criteria of the same endpoint
- The webhook receiver and response submission share no code — they can be developed independently
- Total: 14 tasks across 5 phases
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
