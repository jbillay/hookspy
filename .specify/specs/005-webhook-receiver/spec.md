# Feature Specification: Webhook Receiver

**Feature Branch**: `005-webhook-receiver`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Serverless function to receive, store, and relay webhook responses

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
3. **Given** the browser relay encountered an error forwarding to localhost, **When** it POSTs to `/api/logs/xyz/response` with `{error: "Connection refused"}`, **Then** the log status is set to `error` and `error_message` is stored
4. **Given** a response is submitted, **When** `responded_at` and `duration_ms` are calculated, **Then** the values accurately reflect the time from `received_at` to response submission

---

### Edge Cases

- What happens when two browsers submit responses for the same log? First write wins; subsequent writes are ignored (check status before update)
- What happens when the serverless function times out just as the response arrives? The response is stored but the external system gets 504; the log shows `responded` status
- What happens when the request body is binary? Store as base64-encoded string with a flag
- What happens when the serverless function cold starts? First request may have added latency; this is acceptable
- What happens when an endpoint receives more than 60 requests per minute? Requests beyond the limit are rejected with 429 Too Many Requests and are not stored
- What happens when a request body exceeds 1MB? The request is rejected with 413 Payload Too Large and is not stored
- What happens when no browser relay is connected? The receiver polls until timeout regardless; no relay-presence awareness is implemented

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement a webhook receiver endpoint at `/api/hook/:slug` that handles all HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- **FR-002**: The receiver MUST look up the endpoint by slug and verify it exists and is active
- **FR-003**: If the endpoint is not found or is inactive, the receiver MUST return 404 with `{"error": "Endpoint not found"}`
- **FR-004**: The receiver MUST insert a new `webhook_logs` record with: `endpoint_id`, `status: 'pending'`, `request_method`, `request_url` (including query string), `request_headers` (all headers as JSON), `request_body` (raw body), `received_at: now()`
- **FR-005**: After inserting the log, the receiver MUST enter a polling loop: query the log every 500ms, checking if `status` has changed from `pending`
- **FR-006**: If the log status becomes `responded`, the receiver MUST return an HTTP response with the stored `response_status`, `response_headers`, and `response_body`
- **FR-007**: If the elapsed time exceeds the endpoint's `timeout_seconds`, the receiver MUST update the log status to `timeout` and return HTTP 504 with `{"error": "Gateway Timeout", "message": "Local server did not respond within {timeout}s"}`
- **FR-008**: System MUST implement a response submission endpoint at `POST /api/logs/:id/response` that accepts `{status, headers, body}` or `{error}` from the browser relay
- **FR-009**: The response submission endpoint MUST validate that the log exists and is in `pending` or `forwarding` status before accepting the response; if the log is already in `responded`, `timeout`, or `error` status, the endpoint MUST return HTTP 409 with `{"error": "Log already resolved"}`
- **FR-010**: The response submission endpoint MUST calculate `duration_ms` as the difference between `received_at` and the current time
- **FR-011**: The response submission endpoint MUST require authentication (the browser relay sends the user's session token)
- **FR-012**: The response submission endpoint MUST verify the authenticated user owns the endpoint associated with the log
- **FR-013**: The webhook receiver endpoint (`/api/hook/:slug`) MUST NOT require authentication (external systems do not have credentials)
- **FR-014**: All API endpoints MUST set appropriate CORS headers allowing the SPA origin
- **FR-015**: The webhook receiver MUST enforce a per-endpoint rate limit of 60 requests per minute; requests exceeding the limit MUST be rejected with HTTP 429 and `{"error": "Too Many Requests"}` without creating a log entry
- **FR-016**: The webhook receiver MUST reject request bodies larger than 1MB with HTTP 413 and `{"error": "Payload Too Large"}` without creating a log entry

### Key Entities

- **webhook_logs**: The central record tracking the full lifecycle from `pending` → `forwarding` → `responded` | `timeout` | `error`. Contains request data (method, URL, headers, body), response data (status, headers, body), timing information (`received_at`, `responded_at`, `duration_ms`), and error details if applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Webhooks sent to valid, active endpoints are stored with 100% fidelity (method, headers, body, URL)
- **SC-002**: When the browser relay responds within timeout, the external system receives the exact response (status, headers, body) from the local server
- **SC-003**: When no response arrives within timeout, the external system receives 504 and the log shows `timeout` status
- **SC-004**: The polling loop completes within the platform's serverless function time limit (max configurable timeout is 55s)
- **SC-005**: Non-existent or inactive endpoints return 404 within 100ms

## Clarifications

### Session 2026-02-10

- Q: Should the public webhook receiver have rate limiting, and if so, what kind? → A: Per-endpoint rate limit of 60 requests/minute per slug
- Q: What is the maximum allowed request body size? → A: 1MB maximum; larger payloads rejected with 413
- Q: What should happen when no browser relay is connected? → A: Always poll until timeout; no relay-presence tracking
- Q: What HTTP status should be returned when a response is submitted for an already-resolved log? → A: 409 Conflict with `{"error": "Log already resolved"}`
