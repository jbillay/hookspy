# Feature Specification: Log Viewer

**Feature Branch**: `007-log-viewer`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Real-time webhook log display with request/response details

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Views Webhook Logs in Real Time (Priority: P1)

An authenticated user sees a live-updating list of all webhook requests for a
specific endpoint. New entries appear at the top of the list immediately when
they arrive, and status changes (pending to responded/timeout/error) update
in place.

**Why this priority**: Observability is a core value proposition of HookSpy.

**Independent Test**: Open the log viewer for an endpoint, trigger a webhook, and
verify the new log entry appears at the top within 1 second.

**Acceptance Scenarios**:

1. **Given** I am viewing logs for Endpoint X, **When** a new webhook arrives, **Then** a new row appears at the top of the list within 1 second
2. **Given** a log entry shows status `pending`, **When** the browser relay completes and the status changes to `responded`, **Then** the row updates in place to show `responded` with a green badge
3. **Given** a log entry shows status `pending`, **When** the timeout is reached, **Then** the row updates to show `timeout` with an orange badge
4. **Given** a log entry shows status `error`, **Then** the row displays a red badge with the error message visible on hover
5. **Given** the log list has 50+ entries, **When** I scroll, **Then** the list loads smoothly with no performance issues

---

### User Story 2 - User Inspects Request and Response Details (Priority: P1)

An authenticated user clicks on a log entry to see the full details of the
incoming webhook request and the corresponding response from the local server,
displayed side by side.

**Why this priority**: Detailed inspection is essential for webhook debugging.

**Independent Test**: Click a log entry with status `responded` and verify both
request and response details are displayed with headers and body.

**Acceptance Scenarios**:

1. **Given** I click a log entry, **When** the detail panel opens, **Then** I see two sections: "Request" (left) and "Response" (right)
2. **Given** the request section, **When** displayed, **Then** I see: HTTP method badge, full URL, all headers as a key-value list, and the body
3. **Given** the response section, **When** displayed and status is `responded`, **Then** I see: status code (color-coded), all response headers, and the response body
4. **Given** the response section, **When** status is `timeout`, **Then** I see "No response — timed out after Xs"
5. **Given** the response section, **When** status is `error`, **Then** I see the error message with CORS guidance if applicable
6. **Given** the body contains JSON, **When** displayed, **Then** it is syntax-highlighted and pretty-printed with an option to toggle raw view
7. **Given** the detail panel, **When** I look at the header, **Then** I see the duration (e.g., "Responded in 234ms") and timestamp

---

### User Story 3 - User Views Logs Across All Endpoints (Priority: P2)

An authenticated user views a combined log feed showing webhooks from all
their endpoints in a single chronological list, with the endpoint name visible
on each entry.

**Why this priority**: Convenient but not essential — users can view per-endpoint logs.

**Independent Test**: View the combined log feed and verify entries from multiple
endpoints appear in chronological order.

**Acceptance Scenarios**:

1. **Given** I have 3 endpoints with recent activity, **When** I navigate to the "All Logs" view, **Then** I see logs from all endpoints sorted by received_at DESC
2. **Given** the combined view, **When** I look at a log entry, **Then** I see the endpoint name as an additional column/badge
3. **Given** the combined view, **When** a new webhook arrives on any endpoint, **Then** it appears at the top of the list in real time

---

### Edge Cases

- What happens when a log has no body (e.g., GET request)? Show "No body" placeholder
- What happens when the body is very large (>100KB)? Show a truncated preview with "Show full body" toggle
- What happens when the response headers contain sensitive data? Display as-is — the user owns the data
- What happens when the Realtime connection drops during log viewing? Reconnect and show a temporary "Reconnecting..." banner

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a log list view at `/endpoints/:id/logs` showing all logs for a specific endpoint
- **FR-002**: System MUST provide a combined log view at `/logs` showing all logs across all user endpoints
- **FR-003**: The log list MUST use PrimeVue DataTable with columns: timestamp, method (badge), URL path, status (colored badge), duration, and actions
- **FR-004**: The log list MUST update in real time via Supabase Realtime subscriptions (INSERT and UPDATE events)
- **FR-005**: New log entries MUST appear at the top of the list
- **FR-006**: Status badge colors: `pending` (blue), `forwarding` (blue, pulsing), `responded` (green), `timeout` (orange), `error` (red)
- **FR-007**: System MUST provide a log detail view (either as a separate page at `/logs/:id` or as an expandable row/sidebar)
- **FR-008**: The log detail view MUST display request and response side by side with: method, URL, headers (key-value list), body (with syntax highlighting for JSON/XML)
- **FR-009**: System MUST implement a `PayloadViewer.vue` component that: auto-detects JSON and pretty-prints with syntax highlighting, provides a toggle between "Pretty" and "Raw" views, shows "No body" for empty payloads, truncates bodies over 100KB with a "Show full" option
- **FR-010**: System MUST display timing information: `received_at` timestamp, `responded_at` timestamp, `duration_ms` formatted as "Xms" or "X.Xs"
- **FR-011**: System MUST provide an API endpoint `GET /api/logs?endpoint_id=X` that returns paginated logs (default 50 per page, ordered by `received_at DESC`)
- **FR-012**: System MUST provide an API endpoint `GET /api/logs/:id` that returns a single log with full details
- **FR-013**: System MUST implement a Pinia store (`stores/logs.js`) for log state management with real-time update integration

### Key Entities

- **LogList**: PrimeVue DataTable showing summary of webhook logs
- **LogDetail**: Side-by-side request/response inspector
- **PayloadViewer**: Reusable component for rendering headers and bodies with formatting

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New webhook logs appear in the UI within 1 second of database insertion
- **SC-002**: Status changes (pending to responded/timeout/error) update in the table without page refresh
- **SC-003**: JSON bodies are syntax-highlighted and pretty-printed correctly
- **SC-004**: The log detail view accurately displays all stored request and response data
- **SC-005**: The DataTable handles 100+ rows without noticeable performance degradation
