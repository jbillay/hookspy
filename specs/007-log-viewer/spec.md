# Feature Specification: Log Viewer

**Feature Branch**: `007-log-viewer`
**Created**: 2026-02-12
**Status**: Draft
**Input**: Real-time webhook log display with request/response details

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Webhook Logs in Real Time (Priority: P1)

An authenticated user sees a live-updating list of all webhook requests for a
specific endpoint. New entries appear at the top of the list immediately when
they arrive, and status changes (pending to forwarding, responded, timeout,
or error) update in place without page refresh.

**Why this priority**: Observability is the core value proposition of HookSpy.
Without the ability to see incoming webhooks, the relay feature has no
visibility layer.

**Independent Test**: Open the log viewer for an endpoint, trigger a webhook
via curl, and verify the new log entry appears at the top within 1 second.

**Acceptance Scenarios**:

1. **Given** I am viewing logs for Endpoint X, **When** a new webhook arrives, **Then** a new row appears at the top of the list within 1 second
2. **Given** a log entry shows status `pending`, **When** the browser relay completes and the status changes to `responded`, **Then** the row updates in place to show `responded` with a green badge
3. **Given** a log entry shows status `pending`, **When** the relay begins forwarding, **Then** the row updates to show `forwarding` with a pulsing blue badge
4. **Given** a log entry shows status `pending`, **When** the timeout is reached, **Then** the row updates to show `timeout` with an orange badge
5. **Given** a log entry shows status `error`, **Then** the row displays a red badge with the error message visible on hover
6. **Given** the log list has 50+ entries, **When** I scroll, **Then** the list loads smoothly with no performance issues

---

### User Story 2 - Inspect Request and Response Details (Priority: P1)

An authenticated user clicks on a log entry to expand it inline, revealing the
full details of the incoming webhook request and the corresponding response
from the local server, displayed side by side within the expanded row. The log
list remains visible above and below, preserving context.

**Why this priority**: Detailed inspection is essential for webhook debugging.
Developers need to see exact headers, bodies, and status codes to diagnose
integration issues.

**Independent Test**: Click a log entry with status `responded` and verify both
request and response details are displayed with headers and body.

**Acceptance Scenarios**:

1. **Given** I click a log entry, **When** the row expands inline, **Then** I see two sections: "Request" (left) and "Response" (right) within the expanded area
2. **Given** the request section, **When** displayed, **Then** I see: HTTP method badge, full URL, all headers as a key-value list, and the body
3. **Given** the response section, **When** displayed and status is `responded`, **Then** I see: status code (color-coded), all response headers, and the response body
4. **Given** the response section, **When** status is `timeout`, **Then** I see "No response — timed out" with the timeout duration
5. **Given** the response section, **When** status is `error`, **Then** I see the error message with CORS guidance if applicable
6. **Given** the body contains JSON, **When** displayed, **Then** it is syntax-highlighted and pretty-printed with an option to toggle raw view
7. **Given** the detail view, **When** I look at the header, **Then** I see the duration (e.g., "Responded in 234ms") and timestamp

---

### User Story 3 - View Logs Across All Endpoints (Priority: P2)

An authenticated user views a combined log feed showing webhooks from all
their endpoints in a single chronological list, with the endpoint name visible
on each entry.

**Why this priority**: Convenient but not essential — users can already view
per-endpoint logs from User Story 1.

**Independent Test**: View the combined log feed and verify entries from multiple
endpoints appear in chronological order with endpoint names shown.

**Acceptance Scenarios**:

1. **Given** I have 3 endpoints with recent activity, **When** I navigate to the "All Logs" view, **Then** I see logs from all endpoints sorted by most recent first
2. **Given** the combined view, **When** I look at a log entry, **Then** I see the endpoint name as an additional column or badge
3. **Given** the combined view, **When** a new webhook arrives on any endpoint, **Then** it appears at the top of the list in real time

---

### Edge Cases

- What happens when a log has no body (e.g., GET request)? Show "No body" placeholder
- What happens when the body is very large (>100KB)? Show a truncated preview with "Show full body" toggle
- What happens when the response headers contain sensitive data? Display as-is — the user owns the data
- What happens when the real-time connection drops during log viewing? Show a temporary "Reconnecting..." banner and automatically reconnect
- What happens when a log is in `forwarding` status for an extended time? Continue showing the pulsing indicator — the status will eventually transition to responded, timeout, or error

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a log list view for a specific endpoint showing all webhook logs for that endpoint
- **FR-002**: System MUST provide a combined log view showing all logs across all of the user's endpoints
- **FR-003**: The log list MUST display columns: timestamp, HTTP method (as a badge), URL path, status (colored badge), duration, and actions
- **FR-004**: The log list MUST update in real time — new entries appear and status changes reflect without page refresh
- **FR-005**: New log entries MUST appear at the top of the list (sorted by received time, descending)
- **FR-006**: Status badge colors MUST be: `pending` (blue), `forwarding` (blue, pulsing), `responded` (green), `timeout` (orange), `error` (red)
- **FR-007**: System MUST provide a log detail view as an expandable inline row — clicking a log entry expands it in place to show full request and response information, keeping the list visible for context
- **FR-008**: The log detail view MUST display request and response side by side with: method, URL, headers (key-value list), body (with syntax highlighting for JSON)
- **FR-009**: System MUST auto-detect JSON bodies and pretty-print them with syntax highlighting, with a toggle between "Pretty" and "Raw" views
- **FR-010**: System MUST show "No body" for empty payloads and truncate bodies over 100KB with a "Show full" option
- **FR-011**: System MUST display timing information: received timestamp, responded timestamp, and duration formatted as human-readable time (e.g., "234ms" or "1.2s")
- **FR-012**: The combined log view (FR-002) MUST show the endpoint name on each entry so the user can distinguish which endpoint received the webhook
- **FR-013**: Log lists MUST be paginated with traditional numbered page controls (next/previous and page numbers) with a default of 50 entries per page

### Key Entities

- **WebhookLog**: A record of a single webhook received by the system, including request details (method, URL, headers, body), response details (status code, headers, body), status (pending/forwarding/responded/timeout/error), timing, and associated endpoint
- **PayloadViewer**: A reusable display for rendering headers and bodies with JSON formatting support

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New webhook logs appear in the UI within 1 second of being received
- **SC-002**: Status changes (pending to forwarding/responded/timeout/error) update in the list without page refresh
- **SC-003**: JSON bodies are syntax-highlighted and pretty-printed correctly
- **SC-004**: The log detail view accurately displays all stored request and response data including headers and bodies
- **SC-005**: The log list handles 100+ entries without noticeable performance degradation
- **SC-006**: Users can toggle between pretty-printed and raw JSON views

## Clarifications

### Session 2026-02-12

- Q: How should the log detail view appear — separate page, expandable row, or sidebar/dialog? → A: Expandable inline row (keeps list context visible, natural debugging flow)
- Q: What pagination style for the log list — page numbers, load more, or infinite scroll? → A: Traditional numbered page controls (simplest, works well with real-time updates)
