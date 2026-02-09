# Feature Specification: Replay & Search

**Feature Branch**: `008-replay-search`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Webhook replay functionality and log search/filtering

## User Scenarios & Testing *(mandatory)*

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

1. **Given** a webhook log with status `responded`, **When** I click the "Replay" button, **Then** a new webhook_log record is created with the same `request_method`, `request_headers`, `request_body`, and `request_url`, with status `pending`
2. **Given** the replay log is created, **When** the browser relay detects it via Realtime, **Then** it forwards the request to the local server just like an original webhook
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

1. **Given** I have 20 webhook logs, **When** I type "payment.success" in the search box, **Then** only logs whose `request_body` or `request_url` contains "payment.success" are shown
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

1. **Given** I select "POST" in the method filter, **When** the filter is applied, **Then** only logs with `request_method: "POST"` are shown
2. **Given** I select "error" in the status filter, **When** the filter is applied, **Then** only logs with `status: "error"` are shown
3. **Given** I have both method and status filters active, **When** combined, **Then** only logs matching both criteria are shown
4. **Given** I clear all filters, **When** the list reloads, **Then** all logs are shown

---

### User Story 4 - User Filters Logs by Date Range (Priority: P3)

An authenticated user selects a date/time range to narrow logs to a specific
time window.

**Why this priority**: Useful for finding old messages but lower priority given
24h retention.

**Independent Test**: Set a date range filter for the last hour and verify only
recent logs are shown.

**Acceptance Scenarios**:

1. **Given** I set a "From" date of 2 hours ago and "To" of 1 hour ago, **When** the filter is applied, **Then** only logs received within that window are shown
2. **Given** I set only a "From" date, **When** the filter is applied, **Then** logs from that time onward are shown
3. **Given** I clear the date range, **When** the list reloads, **Then** all logs are shown

---

### Edge Cases

- What happens when replaying a webhook whose endpoint has been deleted? Replay should fail with an error toast "Endpoint no longer exists"
- What happens when replaying a webhook whose endpoint configuration has changed? Use the current endpoint config (new target URL/port/headers), not the original
- What happens when searching with special characters? Escape for SQL safety (handled by Supabase client parameterized queries)
- What happens when filters result in zero matches? Show an empty state with "No logs match your filters"

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Replay" button on each log entry (both in the list and detail view)
- **FR-002**: Replay MUST create a new `webhook_logs` record by copying `endpoint_id`, `request_method`, `request_url`, `request_headers`, `request_body` from the original log, with a new `id`, `status: 'pending'`, and `received_at: now()`
- **FR-003**: Replayed logs MUST include a `replayed_from` field (or equivalent) referencing the original log ID, so the UI can display a replay badge
- **FR-004**: System MUST provide an API endpoint `POST /api/logs/:id/replay` that creates the replay log (auth required, ownership verified)
- **FR-005**: System MUST provide a search input in the log list that filters logs client-side for small datasets and via API for large datasets
- **FR-006**: The search MUST match against: `request_body`, `request_url`, `response_body`, `error_message`
- **FR-007**: System MUST provide a `LogFilters.vue` component with: method dropdown (multi-select from PrimeVue MultiSelect), status dropdown (multi-select), date range picker (PrimeVue Calendar with range mode), and a text search input (PrimeVue InputText with search icon)
- **FR-008**: The `GET /api/logs` endpoint MUST support query parameters: `endpoint_id`, `method` (comma-separated), `status` (comma-separated), `from` (ISO date), `to` (ISO date), `q` (text search), `page`, `limit`
- **FR-009**: Filters MUST be combinable — all active filters are AND-ed together
- **FR-010**: Filter state MUST be reflected in the URL query string so filtered views are bookmarkable/shareable
- **FR-011**: When filters are active, the UI MUST show a "Clear all filters" button
- **FR-012**: The empty state for filtered results MUST display "No logs match your filters" with a link to clear filters

### Key Entities

- **Replay log**: A webhook_log created from a previous log's request data, with `replayed_from` reference
- **LogFilters**: UI component managing the active filter state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Replaying a webhook creates a new log entry that is forwarded by the browser relay identically to the original
- **SC-002**: Replayed logs are visually distinguishable from original webhooks
- **SC-003**: Text search returns matching results within 500ms for datasets under 1000 logs
- **SC-004**: Method and status filters correctly narrow the log list
- **SC-005**: Combined filters (method + status + search + date) work correctly together
- **SC-006**: Filter state persists in the URL and survives page refresh
