# Feature Specification: Browser Relay Engine

**Feature Branch**: `006-browser-relay`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Browser-based webhook forwarding to localhost

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browser Receives and Forwards Webhooks in Real Time (Priority: P1)

When the HookSpy dashboard is open, the browser automatically listens for new
incoming webhooks. When a new webhook arrives with status `pending`, the browser
constructs an HTTP request matching the original (method, headers, body) and sends
it to the configured local target URL.

**Why this priority**: This is the core client-side mechanism — the "magic" of HookSpy.
Without this, the product has no forwarding capability.

**Independent Test**: Open the dashboard, trigger a webhook from an external tool,
and verify the browser forwards it to a running local server.

**Acceptance Scenarios**:

1. **Given** I have the dashboard open and an active endpoint configured to forward to `localhost:3000/webhook`, **When** a new webhook POST arrives at my endpoint, **Then** my browser sends the same POST to `http://localhost:3000/webhook` within 1 second
2. **Given** the original webhook had method PUT and headers `Content-Type: application/json` and `X-Custom: test`, **When** forwarded, **Then** the local server receives a PUT request with the exact same headers
3. **Given** the original webhook had a JSON body `{"event": "payment.success"}`, **When** forwarded, **Then** the local server receives the exact same body
4. **Given** the endpoint has custom headers `X-Api-Key: secret123` configured, **When** forwarding, **Then** the browser adds `X-Api-Key: secret123` to the request alongside the original headers (custom headers take precedence on key conflicts)
5. **Given** multiple endpoints are active, **When** webhooks arrive for different endpoints, **Then** each is forwarded to its own configured target

---

### User Story 2 - Browser Relays Local Server Response Back (Priority: P1)

After forwarding the webhook to localhost, the browser captures the response
(status code, headers, body) and sends it back to the HookSpy server, which
then returns it to the original webhook sender.

**Why this priority**: Without the response relay, the round trip is incomplete.
The original sender would never receive a response from the local server.

**Independent Test**: Forward a webhook to localhost, have the local server respond
with a custom status and body, and verify it reaches the original sender.

**Acceptance Scenarios**:

1. **Given** the local server responds with status 200, headers `X-Processed: true`, and body `{"ok": true}`, **When** the browser receives this response, **Then** it submits the full response (status, headers, body) to the server for relay back to the original sender
2. **Given** the local server responds with status 400, **When** relayed, **Then** the original sender receives HTTP 400 with the exact response body
3. **Given** the local server responds with status 500, **When** relayed, **Then** the original sender receives HTTP 500 (relay does not alter error responses)

---

### User Story 3 - Browser Handles Relay Errors Gracefully (Priority: P1)

When the browser cannot reach the local server (CORS error, connection refused,
network error), it reports the error back to the server and displays it in the UI.

**Why this priority**: Error visibility is essential for debugging. Without clear
error reporting, users cannot diagnose forwarding problems.

**Independent Test**: Stop the local server, trigger a webhook, and verify the
dashboard shows an error message and the webhook sender receives a failure response.

**Acceptance Scenarios**:

1. **Given** the local server is not running, **When** the browser tries to forward, **Then** the webhook log status is set to `error` with message "Connection refused: http://localhost:3000/webhook"
2. **Given** the local server does not have CORS enabled, **When** the browser tries to forward, **Then** the webhook log status is set to `error` with a CORS-specific error message
3. **Given** a CORS error occurs, **When** displayed in the UI, **Then** a helpful message explains how to enable CORS on the local server
4. **Given** the local server takes longer than the endpoint's configured timeout to respond, **When** the browser is still waiting, **Then** it continues waiting (the server-side webhook receiver handles timeout enforcement)

---

### User Story 4 - Relay Status Indicator (Priority: P2)

The dashboard header shows a real-time indicator of relay status — whether the
real-time subscription is active and the browser is ready to forward webhooks.

**Why this priority**: Users need to know if their relay is working before testing.
This provides at-a-glance confidence that forwarding is operational.

**Independent Test**: Open the dashboard and verify the relay status indicator shows
"Active". Disconnect the real-time subscription and verify it shows "Inactive".

**Acceptance Scenarios**:

1. **Given** the dashboard is open and the real-time subscription is connected, **When** I look at the header, **Then** I see a green dot with "Relay Active"
2. **Given** the real-time connection drops, **When** I look at the header, **Then** I see a red dot with "Relay Inactive" and the system attempts to reconnect
3. **Given** the relay reconnects, **When** the connection is restored, **Then** the indicator returns to green "Relay Active"
4. **Given** I have no active endpoints, **When** I look at the header, **Then** I see an amber dot with "No Active Endpoints"

---

### Edge Cases

- What happens when multiple webhooks arrive simultaneously? Each is forwarded in parallel (no queuing)
- What happens when the browser tab is in the background? Relay should still work but may experience slight delays due to browser throttling
- What happens when the real-time subscription fails? Auto-reconnect with exponential backoff; status indicator shows "Inactive" during reconnection
- What happens when the user has many endpoints? Subscribe to all active endpoints with a single subscription filtered by the user's endpoint IDs
- What happens when an endpoint is created, deleted, or toggled while the relay is running? The subscription must be updated to reflect the current set of active endpoints
- What happens when the dashboard is open in multiple browser tabs? The first tab to claim the webhook (by updating status to `forwarding`) wins; other tabs skip webhooks already in `forwarding` or later status. No duplicate forwarding occurs.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST run an invisible background process within the dashboard that listens for new incoming webhooks in real time
- **FR-002**: The background listener MUST subscribe to new webhook log inserts filtered to the authenticated user's active endpoint IDs
- **FR-003**: On receiving a new webhook log with status `pending`, the system MUST construct an HTTP request to `{target_url}:{target_port}{target_path}` using the original `request_method`, `request_headers`, and `request_body`
- **FR-004**: Before forwarding, the system MUST merge the endpoint's `custom_headers` into the request headers, with custom headers taking precedence on key conflicts. Browser-restricted headers (e.g., Host, Origin, Cookie, Content-Length) MUST be silently skipped.
- **FR-005**: After receiving the local server's response, the system MUST submit the response data (status code, headers as plain object, body as text) to the server for relay back to the original sender
- **FR-006**: If the request to localhost fails (network error, CORS), the system MUST report the error to the server with a descriptive error message
- **FR-007**: The system MUST expose relay lifecycle management as a reusable module: subscription lifecycle, forwarding logic, error handling, and relay status state
- **FR-008**: The system MUST display a status indicator in the dashboard header showing connection state (Active/Inactive/No Endpoints) with a colored dot
- **FR-009**: The real-time subscription MUST automatically reconnect on connection loss with exponential backoff
- **FR-010**: When the user's endpoint list changes (create/delete/toggle), the subscription MUST be updated to reflect the current active endpoints
- **FR-011**: Before sending the forwarding request, the system MUST update the webhook log status to `forwarding` to indicate processing has begun. If the status is already `forwarding` or later, the system MUST skip this webhook (another tab has already claimed it).
- **FR-012**: All forwarding requests to localhost MUST use CORS mode to surface CORS errors clearly to the user

### Key Entities

- **Relay Worker**: Invisible background process responsible for listening for new webhooks and forwarding them to the local server
- **Relay Status**: Visual indicator showing the current state of the relay connection (Active, Inactive, No Active Endpoints)
- **Relay Module**: Reusable logic for relay lifecycle management, forwarding, and error handling

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Webhooks are forwarded to the local server within 1 second of arrival (when real-time connection is active)
- **SC-002**: Local server responses are relayed back with 100% fidelity (status code, headers, body unchanged). Request header fidelity excludes browser-restricted headers (see Assumptions).
- **SC-003**: CORS errors are detected and displayed with actionable guidance for the user
- **SC-004**: The relay status indicator accurately reflects the current connection state at all times
- **SC-005**: Multiple simultaneous webhooks are all forwarded without loss
- **SC-006**: Real-time subscription reconnects within 5 seconds of connection loss

## Clarifications

### Session 2026-02-12

- Q: How should the system handle duplicate forwarding when the dashboard is open in multiple browser tabs? → A: First tab wins — the first tab to update the log status to `forwarding` claims the webhook; other tabs skip webhooks already in `forwarding` or later status.
- Q: How should the system handle browser-restricted headers (Host, Origin, Cookie, Content-Length) that cannot be set programmatically? → A: Silently skip browser-restricted headers; document as a known limitation.

## Assumptions

- The user's local development server has CORS enabled to allow browser-based requests from the HookSpy domain
- The HookSpy dashboard (SPA) must be open in a browser tab for webhook forwarding to work
- The existing server-side webhook receiver handles timeout enforcement; the browser relay does not need to enforce its own timeout
- The existing response submission endpoint (`/api/logs/:id/response`) is functional and handles status updates
- Endpoints store provides real-time access to the user's endpoint configurations including target URL, port, path, and custom headers
- Browser-restricted headers (Host, Origin, Cookie, Content-Length, and other fetch API forbidden headers) cannot be set programmatically and are silently skipped during forwarding. This is a known browser platform limitation.
