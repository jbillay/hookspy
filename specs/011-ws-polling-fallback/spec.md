# Feature Specification: WebSocket Polling Fallback

**Feature Branch**: `011-ws-polling-fallback`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Implement an adaptive transport layer for HookSpy that provides automatic polling fallback when WebSocket connections (Supabase Realtime) are blocked by corporate firewalls/proxies."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Transparent Fallback When WebSockets Are Blocked (Priority: P1)

A developer working behind a corporate firewall opens HookSpy to relay webhooks to their local server. Their network blocks WebSocket connections. After a brief detection period, the system automatically switches to HTTP polling so the relay, log viewer, and dashboard continue to function without any manual intervention.

**Why this priority**: This is the core value proposition. Without this, the entire app is non-functional for users in WebSocket-restricted environments. It directly enables the relay — HookSpy's primary feature — to work universally.

**Independent Test**: Can be tested by blocking WebSocket connections (e.g., via browser DevTools network throttling or proxy config) and verifying that incoming webhooks are still received and forwarded to localhost within a few seconds.

**Acceptance Scenarios**:

1. **Given** a user is authenticated and has active endpoints, **When** the WebSocket connection fails to establish after 3 consecutive attempts within 30 seconds, **Then** the system automatically switches to HTTP polling mode and continues receiving webhook events.
2. **Given** the system is in polling mode, **When** a webhook arrives at the user's endpoint, **Then** the relay worker receives it via the next poll cycle (within 2-3 seconds) and forwards it to localhost.
3. **Given** the system is in polling mode, **When** the relay forwards a webhook and receives a response from localhost, **Then** the response is submitted back to the server and the log entry updates to reflect the completed relay.

---

### User Story 2 - Automatic Recovery to WebSocket (Priority: P2)

A developer's network intermittently blocks WebSockets (e.g., a VPN that reconnects, or a temporary proxy issue). Once the WebSocket connection becomes available again, the system automatically detects this and switches back from polling to the faster WebSocket transport.

**Why this priority**: Ensures optimal performance is restored when possible, without requiring the user to refresh or take any action.

**Independent Test**: Can be tested by first blocking WebSockets to trigger polling mode, then unblocking them and verifying the system switches back to WebSocket mode within 90 seconds.

**Acceptance Scenarios**:

1. **Given** the system is in polling mode, **When** the system's periodic WebSocket reconnect attempt succeeds, **Then** the system switches back to WebSocket mode and stops the polling loop.
2. **Given** the system switches from polling back to WebSocket mode, **When** a new webhook arrives, **Then** it is delivered via WebSocket in real time (not delayed by a polling interval).

---

### User Story 3 - Transport Mode Visibility (Priority: P3)

A developer notices their webhook relay seems slightly delayed. They glance at the relay status indicator and see an amber "Polling" badge, confirming the system is operating in fallback mode. This helps them understand the behavior without needing to check DevTools or network logs.

**Why this priority**: Provides transparency without being intrusive. Helps users diagnose timing expectations and understand why responses might be slightly slower.

**Independent Test**: Can be tested by observing the relay status indicator in both WebSocket and polling modes, verifying it displays the correct transport mode.

**Acceptance Scenarios**:

1. **Given** the system is connected via WebSocket, **When** the user views the relay status area, **Then** a green indicator shows "Live" transport mode.
2. **Given** the system is operating in polling fallback mode, **When** the user views the relay status area, **Then** an amber indicator shows "Polling" with the polling interval, and a tooltip explains that WebSocket is unavailable.
3. **Given** the system transitions between modes, **When** the transport mode changes, **Then** the indicator updates immediately to reflect the current mode.

---

### User Story 4 - Consistent Live Updates Across All Views (Priority: P2)

A developer using HookSpy behind a corporate proxy navigates between the dashboard, log list, and endpoint detail views. In polling mode, all views continue to show live updates — new log entries appear, statuses transition from "pending" to "responded", and the dashboard activity feed refreshes automatically.

**Why this priority**: The polling fallback must cover all real-time features, not just the relay worker. Partial coverage would create a confusing experience where some views update and others don't.

**Independent Test**: Can be tested by triggering webhooks in polling mode and verifying that the dashboard activity count increments, the log list shows new entries, and log detail status transitions appear without manual page refresh.

**Acceptance Scenarios**:

1. **Given** the system is in polling mode and the user is on the dashboard, **When** a new webhook arrives, **Then** the activity feed updates and the request counter increments within one polling cycle.
2. **Given** the system is in polling mode and the user is on the log list, **When** a webhook's status changes from "pending" to "responded", **Then** the log entry updates in place within one polling cycle.
3. **Given** the system is in polling mode, **When** the user navigates between views, **Then** each view receives live updates appropriate to its subscription scope.

---

### Edge Cases

- What happens when the polling API endpoint itself is unreachable (e.g., full network outage)? The system should display a disconnected state and retry on the next polling cycle without crashing.
- What happens when the user's authentication token expires during polling mode? The polling endpoint returns 401, and the system triggers re-authentication flow.
- What happens when the browser tab is backgrounded or throttled by the OS? Polling naturally slows due to browser timer throttling; on tab focus, the next poll catches up with all missed events via the timestamp cursor.
- What happens when the user has no active endpoints? Polling should not start (no endpoint IDs to poll for), matching current WebSocket behavior.
- What happens when endpoint configuration changes while in polling mode (add/remove/toggle endpoints)? The polling loop updates its endpoint filter on the next cycle.
- What happens with multiple browser tabs open? Each tab manages its own transport independently, matching current WebSocket behavior.
- What happens when the server clock and client clock are out of sync? The system uses server-provided timestamps for poll cursors, avoiding clock drift issues.

## Clarifications

### Session 2026-02-28

- Q: How should the system determine the initial `since` timestamp for the first poll when transitioning from failed WebSocket? → A: Use app-load timestamp as the initial cursor, so the first poll covers the full session from when the user started. Duplicate events already fetched during initial data load are acceptable and should be deduplicated client-side.
- Q: Should the polling API validate that requested endpoint_ids belong to the authenticated user? → A: Yes, the server must validate ownership of all requested endpoint_ids against the authenticated user. Requests containing any endpoint ID not owned by the user are rejected.
- Q: What should the UI show during the initial WebSocket detection window (up to 15 seconds)? → A: Display a "Connecting..." state with a neutral (gray/blue) indicator during detection, then transition to "Live" (green) or "Polling" (amber) once the transport mode is resolved.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST attempt WebSocket connection as the primary transport on startup.
- **FR-002**: System MUST detect persistent WebSocket failure defined as 3 consecutive connection failures within a 30-second window.
- **FR-003**: System MUST automatically switch all real-time subscriptions (relay, logs, dashboard) to HTTP polling when persistent WebSocket failure is detected.
- **FR-004**: System MUST poll for new and updated webhook log entries at a fixed 2-second interval when in polling mode.
- **FR-005**: System MUST use server-provided timestamps (not client clock) as the cursor for subsequent poll requests to avoid clock drift. The initial poll cursor MUST be captured at app-load time (before the first WebSocket attempt) so no events are missed during the detection window.
- **FR-005a**: System MUST deduplicate polled events against data already loaded during initial page fetch to avoid processing the same event twice.
- **FR-006**: System MUST attempt to reconnect via WebSocket every 60 seconds while in polling mode, and switch back transparently if successful.
- **FR-007**: System MUST dispatch polled events to all registered subscription callbacks based on their event type filters (INSERT, UPDATE) and endpoint ID filters.
- **FR-008**: System MUST display a visual indicator showing the current transport mode: neutral (gray/blue) "Connecting..." during initial detection, green "Live" for WebSocket, amber "Polling" for HTTP polling.
- **FR-009**: System MUST provide a tooltip on the polling indicator explaining that WebSocket is unavailable and updates may be slightly delayed. The "Connecting..." state requires no tooltip.
- **FR-010**: System MUST authenticate all polling requests using the same JWT mechanism as other API endpoints. The server MUST validate that all requested endpoint IDs belong to the authenticated user and reject the request if any do not.
- **FR-011**: System MUST handle polling API errors (401, 500, network failure) gracefully without crashing the polling loop.
- **FR-012**: System MUST stop polling when there are no active endpoint subscriptions (no endpoint IDs to poll for).
- **FR-013**: System MUST update polling filters when endpoint configuration changes (endpoints added, removed, or toggled).
- **FR-014**: System MUST provide a unified subscription interface so that stores (relay, logs, dashboard) do not need to know which transport is active.

### Key Entities

- **Transport Session**: Represents the current connection state — mode (WebSocket or polling), connection status, failure count, and last successful connection timestamp.
- **Subscription Registration**: A named subscription with its table target, event type filter (INSERT/UPDATE), endpoint ID filter, and callback function. Multiple subscriptions share a single transport.
- **Poll Cursor**: A server-provided timestamp marking the last successfully polled point in time, used as the `since` parameter for the next poll request.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users in WebSocket-blocked environments can receive and relay webhooks within 4 seconds of arrival (2s polling interval + processing time), compared to complete failure today.
- **SC-002**: The system detects WebSocket unavailability and switches to polling within 15 seconds of first connection attempt.
- **SC-003**: When WebSocket becomes available again, the system recovers to real-time mode within 90 seconds (one reconnect cycle plus margin).
- **SC-004**: All three live-update features (relay forwarding, log list updates, dashboard activity) function correctly in polling mode with no data loss.
- **SC-005**: Users can identify the current transport mode at a glance via the visual indicator without opening developer tools.
- **SC-006**: The polling fallback introduces no additional user configuration or setup — it works automatically for all users.

## Assumptions

- The user's network allows standard HTTPS requests even when WebSocket connections are blocked (this covers the vast majority of corporate firewall scenarios).
- Browser timer throttling in backgrounded tabs is acceptable behavior — users expect reduced update frequency when the tab is not focused.
- A 2-second polling interval provides sufficient responsiveness for the webhook relay use case while keeping API load manageable.
- The existing serverless function infrastructure can handle the additional polling API endpoint without architectural changes.
- The existing database indexes on webhook_logs are sufficient for efficient polling queries, or can be added via a simple migration.

## Dependencies

- Existing real-time subscription integration (channels, subscription callbacks)
- Existing JWT authentication infrastructure
- Existing CORS handling
- Existing database client for server-side queries
- Existing UI component library (for indicator elements)
