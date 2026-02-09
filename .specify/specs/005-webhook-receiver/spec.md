# Feature Specification: Webhook Receiver

**Feature Branch**: `005-webhook-receiver`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Vercel serverless function to receive, store, and relay webhook responses

## User Scenarios & Testing *(mandatory)*

### User Story 1 - External System Sends Webhook and Receives Response (Priority: P1)

An external system (e.g., Stripe, GitHub) sends an HTTP request to a HookSpy
webhook URL. The serverless function stores the request, waits for the browser
relay to forward it to the local server, and returns the local server's response
back to the external system — preserving status code, headers, and body.

**Why this priority**: This is the core server-side mechanism of the entire product.

**Independent Test**: Send an HTTP POST to `/api/hook/:slug`, have the browser relay
respond within the timeout, and verify the response matches what the local server returned.

**Acceptance Scenarios**:

1. **Given** an active endpoint with slug `abc123`, **When** an external system sends `POST /api/hook/abc123` with headers and a JSON body, **Then** the serverless function stores the request in `webhook_logs` with status `pending`
2. **Given** a pending webhook log, **When** the browser relay posts the response within the timeout, **Then** the serverless function returns that response to the external system with the exact status code, headers, and body
3. **Given** a pending webhook log, **When** the browser relay does NOT respond within the configured timeout, **Then** the serverless function returns a 504 Gateway Timeout with a JSON error body and updates the log status to `timeout`
4. **Given** an endpoint slug that does not exist, **When** a request is sent to `/api/hook/nonexistent`, **Then** the function returns 404 with `{"error": "Endpoint not found"}`
5. **Given** an inactive endpoint, **When** a request is sent to its URL, **Then** the function returns 404 with `{"error": "Endpoint not found"}`

---

### User Story 2 - Webhook Supports All HTTP Methods (Priority: P1)

The webhook receiver accepts any HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
and stores the method in the log for faithful forwarding.

**Why this priority**: Different webhook providers use different methods.

**Independent Test**: Send GET, POST, PUT, PATCH, DELETE requests to the same endpoint
and verify all are stored with the correct method.

**Acceptance Scenarios**:

1. **Given** an active endpoint, **When** I send a GET request, **Then** the log records `request_method: "GET"` and the request is processed normally
2. **Given** an active endpoint, **When** I send a PUT request with a body, **Then** the log records `request_method: "PUT"` and the full body
3. **Given** an active endpoint, **When** I send a DELETE request, **Then** the log records `request_method: "DELETE"` and the request is processed normally

---

### User Story 3 - Full Header and Body Preservation (Priority: P1)

All request headers and the complete request body are stored in the webhook log
without any modification, filtering, or truncation.

**Why this priority**: Fidelity is a core principle — zero transformation.

**Independent Test**: Send a request with custom headers and a multi-KB body, then
read the log and verify exact matches.

**Acceptance Scenarios**:

1. **Given** a webhook request with headers `X-Custom: value1` and `Content-Type: application/json`, **When** stored, **Then** `request_headers` contains both headers exactly as sent
2. **Given** a webhook request with a 50KB JSON body, **When** stored, **Then** `request_body` contains the complete body without truncation
3. **Given** a webhook request with a form-encoded body, **When** stored, **Then** `request_body` contains the raw form-encoded string
4. **Given** the full query string `?foo=bar&baz=qux`, **When** stored, **Then** `request_url` includes the complete query string

---

### User Story 4 - Response Submission by Browser (Priority: P1)

The browser relay submits the local server's response back to the serverless
function via a dedicated API endpoint. The webhook receiver function detects
this response and returns it to the original caller.

**Why this priority**: This completes the relay round-trip.

**Independent Test**: Insert a pending log, POST a response to `/api/logs/:id/response`,
and verify the log status changes to `responded`.

**Acceptance Scenarios**:

1. **Given** a pending webhook log with id `xyz`, **When** the browser POSTs to `/api/logs/xyz/response` with `{status: 200, headers: {...}, body: "..."}`, **Then** the log is updated with response data and status `responded`
2. **Given** the log is updated to `responded`, **When** the webhook receiver's polling loop detects it, **Then** the function returns the stored response to the external system
3. **Given** the browser relay encountered a CORS error, **When** it POSTs to `/api/logs/xyz/response` with `{error: "CORS error: ..."}`, **Then** the log status is set to `error` and `error_message` is stored
4. **Given** a response is submitted, **When** `responded_at` and `duration_ms` are calculated, **Then** the values accurately reflect the time from `received_at` to response submission

---

### Edge Cases

- What happens when two browsers submit responses for the same log? First write wins; subsequent writes are ignored (check status before update)
- What happens when the serverless function times out just as the response arrives? The response is stored but the external system gets 504; the log shows `responded` status
- What happens when the request body is binary? Store as base64-encoded string with a flag
- What happens when Vercel's function cold starts? First request may have 1-2s added latency; this is acceptable

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement a Vercel serverless function at `api/hook/[slug].js` that handles all HTTP methods
- **FR-002**: The function MUST look up the endpoint by slug using the Supabase service role client
- **FR-003**: If the endpoint is not found or is inactive, the function MUST return 404
- **FR-004**: The function MUST insert a new `webhook_logs` record with: `endpoint_id`, `status: 'pending'`, `request_method`, `request_url` (including query string), `request_headers` (all headers as JSON), `request_body` (raw body), `received_at: now()`
- **FR-005**: After inserting the log, the function MUST enter a polling loop: query the log by ID every 500ms, checking if `status` has changed from `pending`
- **FR-006**: If the log status becomes `responded`, the function MUST return an HTTP response with the stored `response_status`, `response_headers`, and `response_body`
- **FR-007**: If the elapsed time exceeds the endpoint's `timeout_seconds`, the function MUST update the log status to `timeout` and return HTTP 504 with `{"error": "Gateway Timeout", "message": "Local server did not respond within {timeout}s"}`
- **FR-008**: System MUST implement an API endpoint `POST /api/logs/:id/response` that accepts `{status, headers, body}` or `{error}` from the browser relay
- **FR-009**: The response submission endpoint MUST validate that the log exists and is in `pending` or `forwarding` status before accepting the response
- **FR-010**: The response submission endpoint MUST calculate `duration_ms` as the difference between `received_at` and the current time
- **FR-011**: The response submission endpoint MUST require authentication (the browser relay sends the user's JWT)
- **FR-012**: The response submission endpoint MUST verify the authenticated user owns the endpoint associated with the log
- **FR-013**: The webhook receiver function (`/api/hook/[slug]`) MUST NOT require authentication (external systems do not have JWTs)
- **FR-014**: All API functions MUST set appropriate CORS headers allowing the SPA origin

### Key Entities

- **webhook_logs**: The central record tracking the full lifecycle from `pending` → `forwarding` → `responded` | `timeout` | `error`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Webhooks sent to valid, active endpoints are stored with 100% fidelity (method, headers, body, URL)
- **SC-002**: When the browser relay responds within timeout, the external system receives the exact response (status, headers, body) from the local server
- **SC-003**: When no response arrives within timeout, the external system receives 504 and the log shows `timeout` status
- **SC-004**: The polling loop does not exceed Vercel's 60s function limit (max configurable timeout is 55s)
- **SC-005**: Non-existent or inactive endpoints return 404 within 100ms
