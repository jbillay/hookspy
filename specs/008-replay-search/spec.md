# Feature Specification: Replay & Search

**Feature Branch**: `008-replay-search`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Webhook replay functionality and log search/filtering

## User Scenarios & Testing _(mandatory)_

### User Story 1 - User Replays a Webhook (Priority: P1)

An authenticated user selects a previously captured webhook from the log list
and replays it — re-sending the exact same request to their local server via
the browser relay. This creates a new log entry showing the replay and its
new response.

**Why this priority**: Replay is one of the most requested features for webhook
debugging. It eliminates the need to re-trigger events from external services.

**Independent Test**: View a completed webhook log, click Replay, and verify a
new log entry is created with the same request data but a fresh response.

**Acceptance Scenarios**:

1. **Given** a webhook log with status `responded`, **When** I click the "Replay" button, **Then** a new log record is created with the same request method, headers, body, and URL, with status `pending`
2. **Given** the replay log is created, **When** the browser relay detects it via real-time notifications, **Then** it forwards the request to the local server just like an original webhook
3. **Given** the replayed request is forwarded, **When** the local server responds, **Then** the response is stored in the new log entry and visible in the log viewer
4. **Given** a webhook log with status `timeout` or `error`, **When** I click Replay, **Then** the replay still works — it re-sends the original request regardless of the previous outcome
5. **Given** I replay a webhook, **When** the new log entry appears, **Then** it is visually marked as a "Replay" (e.g., a replay icon or badge) to distinguish it from original webhooks

---

### User Story 2 - User Searches Logs by Text (Priority: P2)

An authenticated user types a search query to filter webhook logs. The search
matches against the request body, request URL, and error messages.

**Why this priority**: Search is important for finding specific webhooks in a busy endpoint
but not blocking for core functionality.

**Independent Test**: Trigger several webhooks with different body content, search
for a specific keyword, and verify only matching logs are shown.

**Acceptance Scenarios**:

1. **Given** I have multiple webhook logs, **When** I type "payment.success" in the search box, **Then** only logs whose request body, request URL, or response body contains "payment.success" are shown
2. **Given** I have searched for a term, **When** I clear the search box, **Then** all logs are shown again
3. **Given** a search is active, **When** a new webhook arrives that matches the search, **Then** it appears in the filtered list in real time
4. **Given** a search is active, **When** a new webhook arrives that does NOT match, **Then** it does not appear in the filtered list

---

### User Story 3 - User Filters Logs by Method and Status (Priority: P2)

An authenticated user uses dropdown filters to narrow down logs by HTTP method
(GET, POST, PUT, etc.) and/or status (pending, responded, timeout, error).

**Why this priority**: Filtering complements search for efficient log navigation.

**Independent Test**: Trigger webhooks with different methods, filter by POST only,
and verify only POST logs are shown.

**Acceptance Scenarios**:

1. **Given** I select "POST" in the method filter, **When** the filter is applied, **Then** only logs with request method POST are shown
2. **Given** I select "error" in the status filter, **When** the filter is applied, **Then** only logs with status "error" are shown
3. **Given** I have both method and status filters active, **When** combined, **Then** only logs matching both criteria are shown
4. **Given** I clear all filters, **When** the list reloads, **Then** all logs are shown

---

### User Story 4 - User Filters Logs by Date Range (Priority: P3)

An authenticated user selects a date/time range to narrow logs to a specific
time window.

**Why this priority**: Useful for finding old messages but lower priority given
24-hour log retention.

**Independent Test**: Set a date range filter for the last hour and verify only
recent logs are shown.

**Acceptance Scenarios**:

1. **Given** I set a "From" date of 2 hours ago and "To" of 1 hour ago, **When** the filter is applied, **Then** only logs received within that window are shown
2. **Given** I set only a "From" date, **When** the filter is applied, **Then** logs from that time onward are shown
3. **Given** I clear the date range, **When** the list reloads, **Then** all logs are shown

---

### Edge Cases

- What happens when replaying a webhook whose endpoint has been deleted? Replay should fail with an error message "Endpoint no longer exists"
- What happens when replaying a webhook whose endpoint configuration has changed? Use the current endpoint config (new target URL/port/headers), not the original
- What happens when searching with special characters? Search is safely parameterized to prevent injection
- What happens when filters result in zero matches? Show an empty state with "No logs match your filters" and a link to clear filters
- What happens when replaying while the browser relay is not active? The replay log is created with status `pending` but will time out unless the relay picks it up — same behavior as any webhook when the relay is inactive

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a "Replay" action on each log entry that has completed (any terminal status: responded, timeout, error)
- **FR-002**: Replay MUST create a new log record by copying the original log's endpoint reference, request method, request URL, request headers, and request body, with a new unique ID, status "pending", and current timestamp
- **FR-003**: Replayed logs MUST reference the original log they were replayed from, so the UI can display a replay badge
- **FR-004**: System MUST provide an API endpoint for creating replay logs (authenticated, ownership verified)
- **FR-005**: The browser relay MUST detect and forward replayed logs identically to original webhooks — no special handling required
- **FR-006**: System MUST provide a text search input in the log list that filters logs by matching against request body, request URL, response body, and error message
- **FR-007**: System MUST provide a filter panel with: HTTP method multi-select, status multi-select, date range picker, and text search input
- **FR-008**: The log listing API MUST support query parameters for: method filter (comma-separated), status filter (comma-separated), date range (from/to ISO dates), and text search
- **FR-009**: All filters MUST be combinable — active filters are AND-ed together
- **FR-010**: Filter state MUST be reflected in the URL query string so filtered views are bookmarkable and shareable
- **FR-011**: When filters are active, the UI MUST show a "Clear all filters" button
- **FR-012**: The empty state for filtered results MUST display "No logs match your filters" with a link to clear filters
- **FR-013**: A database migration MUST add the replay reference column to the webhook logs table

### Key Entities

- **Replay log**: A webhook log created from a previous log's request data, with a reference to the original log
- **Log filters**: The active set of filter criteria (search text, methods, statuses, date range) applied to the log list

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Replaying a webhook creates a new log entry that is forwarded by the browser relay identically to the original
- **SC-002**: Replayed logs are visually distinguishable from original webhooks via a badge or icon
- **SC-003**: Text search returns matching results within 500ms for datasets under 1000 logs
- **SC-004**: Method and status filters correctly narrow the log list
- **SC-005**: Combined filters (method + status + search + date) work correctly together
- **SC-006**: Filter state persists in the URL and survives page refresh

## Assumptions

- The browser relay does not need any modification to handle replayed logs — replayed logs are regular webhook log records with status "pending" and are forwarded identically
- Text search is server-side via the API, not client-side filtering
- The 24-hour log retention policy applies equally to replayed logs
- Replaying a webhook whose endpoint is inactive (not deleted, just toggled off) should still create the log but the relay won't forward it until the endpoint is reactivated
