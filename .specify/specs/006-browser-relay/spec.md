# Feature Specification: Browser Relay Engine

**Feature Branch**: `006-browser-relay`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Browser-based webhook forwarding to localhost

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browser Receives and Forwards Webhooks in Real Time (Priority: P1)

When the HookSpy dashboard is open, the browser automatically listens for new
incoming webhooks via Supabase Realtime. When a new webhook arrives with status
`pending`, the browser constructs an HTTP request matching the original (method,
headers, body) and sends it to the configured local target URL.

**Why this priority**: This is the core client-side mechanism — the "magic" of HookSpy.

**Independent Test**: Open the dashboard, trigger a webhook from an external tool,
and verify the browser forwards it to a running local server.

**Acceptance Scenarios**:

1. **Given** I have the dashboard open and an active endpoint configured to `http://localhost:3000/webhook`, **When** a new webhook POST arrives at the endpoint, **Then** my browser sends the same POST to `http://localhost:3000/webhook` within 1 second
2. **Given** the original webhook had method PUT and headers `Content-Type: application/json` and `X-Custom: test`, **When** forwarded, **Then** the local server receives a PUT request with the exact same headers
3. **Given** the original webhook had a JSON body `{"event": "payment.success"}`, **When** forwarded, **Then** the local server receives the exact same body
4. **Given** the endpoint has custom headers `X-Api-Key: secret123` configured, **When** forwarding, **Then** the browser adds `X-Api-Key: secret123` to the request alongside the original headers
5. **Given** multiple endpoints are active, **When** webhooks arrive for different endpoints, **Then** each is forwarded to its own configured target

---

### User Story 2 - Browser Relays Local Server Response Back (Priority: P1)

After forwarding the webhook to localhost, the browser captures the response
(status code, headers, body) and sends it back to the HookSpy API, which
then returns it to the original webhook sender.

**Why this priority**: Without the response relay, the round trip is incomplete.

**Independent Test**: Forward a webhook to localhost, have the local server respond
with a custom status and body, and verify it reaches the original sender.

**Acceptance Scenarios**:

1. **Given** the local server responds with status 200, headers `X-Processed: true`, and body `{"ok": true}`, **When** the browser receives this response, **Then** it POSTs `{status: 200, headers: {"X-Processed": "true"}, body: "{\"ok\": true}"}` to `/api/logs/:id/response`
2. **Given** the local server responds with status 400, **When** relayed, **Then** the original sender receives HTTP 400 with the exact response body
3. **Given** the local server responds with status 500, **When** relayed, **Then** the original sender receives HTTP 500 (relay does not alter error responses)

---

### User Story 3 - Browser Handles Relay Errors Gracefully (Priority: P1)

When the browser cannot reach the local server (CORS error, connection refused,
network error), it reports the error back to the API and displays it in the UI.

**Why this priority**: Error visibility is essential for debugging.

**Independent Test**: Stop the local server, trigger a webhook, and verify the
dashboard shows an error message and the webhook sender receives a timeout.

**Acceptance Scenarios**:

1. **Given** the local server is not running, **When** the browser tries to forward, **Then** the log status is set to `error` with message "Connection refused: http://localhost:3000/webhook"
2. **Given** the local server does not have CORS enabled, **When** the browser tries to forward, **Then** the log status is set to `error` with a CORS-specific error message
3. **Given** a CORS error occurs, **When** displayed in the UI, **Then** a helpful tooltip or message explains how to enable CORS on the local server
4. **Given** the local server takes longer than 25 seconds to respond, **When** the browser is still waiting, **Then** it continues waiting until the endpoint's timeout is reached (the serverless function handles the timeout)

---

### User Story 4 - Relay Status Indicator (Priority: P2)

The dashboard header shows a real-time indicator of relay status — whether the
Realtime subscription is active and the browser is ready to forward webhooks.

**Why this priority**: Users need to know if their relay is working before testing.

**Independent Test**: Open the dashboard and verify the relay status indicator shows
"Active". Close the Supabase connection and verify it shows "Inactive".

**Acceptance Scenarios**:

1. **Given** the dashboard is open and Realtime is connected, **When** I look at the header, **Then** I see a green dot with "Relay Active"
2. **Given** the Realtime connection drops, **When** I look at the header, **Then** I see a red dot with "Relay Inactive" and the system attempts to reconnect
3. **Given** the relay reconnects, **When** the connection is restored, **Then** the indicator returns to green "Relay Active"
4. **Given** I have no active endpoints, **When** I look at the header, **Then** I see an amber dot with "No Active Endpoints"

---

### Edge Cases

- What happens when multiple webhooks arrive simultaneously? Each is forwarded in parallel (no queuing)
- What happens when the browser tab is in the background? Modern browsers may throttle fetch; relay should still work but may be slightly delayed
- What happens when the Supabase Realtime subscription fails? Auto-reconnect with exponential backoff; status indicator shows "Inactive" during reconnection
- What happens when the user has many endpoints? Subscribe to all active endpoints with a single Realtime channel using a filter on `endpoint_id IN (...)`

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement a `RelayWorker.vue` component that is mounted in the app layout and runs invisibly (no visible UI)
- **FR-002**: The RelayWorker MUST subscribe to Supabase Realtime INSERT events on the `webhook_logs` table, filtered to the user's active endpoint IDs
- **FR-003**: On receiving a new log with status `pending`, the RelayWorker MUST construct a `fetch()` request to `{target_url}:{target_port}{target_path}` using the original `request_method`, `request_headers`, and `request_body`
- **FR-004**: Before forwarding, the RelayWorker MUST merge the endpoint's `custom_headers` into the request headers (custom headers take precedence on key conflicts)
- **FR-005**: After receiving the local server's response, the RelayWorker MUST POST the response data (status, headers as plain object, body as text) to `/api/logs/:id/response`
- **FR-006**: If the fetch to localhost fails (network error, CORS), the RelayWorker MUST POST an error report to `/api/logs/:id/response` with `{error: "<descriptive message>"}`
- **FR-007**: System MUST implement a `useRelay` composable that manages: subscription lifecycle, forwarding logic, error handling, and relay status state
- **FR-008**: System MUST implement a `RelayStatus.vue` component displaying connection state (Active/Inactive/No Endpoints) with a colored indicator dot
- **FR-009**: The Realtime subscription MUST automatically reconnect on connection loss
- **FR-010**: When the user's endpoint list changes (create/delete/toggle), the subscription MUST be updated to reflect the current active endpoints
- **FR-011**: The RelayWorker MUST update the webhook_log status to `forwarding` (via the response endpoint) before sending the fetch to indicate the request is being processed
- **FR-012**: All fetch requests to localhost MUST include `mode: 'cors'` to surface CORS errors clearly

### Key Entities

- **RelayWorker**: Invisible Vue component responsible for the Realtime subscription and forwarding logic
- **RelayStatus**: Visible status indicator in the app header
- **useRelay composable**: Reusable logic for relay lifecycle management

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Webhooks are forwarded to the local server within 1 second of arrival (when Realtime is connected)
- **SC-002**: Local server responses are relayed back with 100% fidelity (status, headers, body)
- **SC-003**: CORS errors are detected and displayed with actionable guidance
- **SC-004**: The relay status indicator accurately reflects the current connection state
- **SC-005**: Multiple simultaneous webhooks are all forwarded without loss
- **SC-006**: Realtime subscription reconnects within 5 seconds of connection loss
