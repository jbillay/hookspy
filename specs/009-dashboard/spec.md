# Feature Specification: Dashboard

**Feature Branch**: `009-dashboard`
**Created**: 2026-02-12
**Status**: Draft
**Input**: Overview dashboard with endpoint summaries and quick actions

## User Scenarios & Testing _(mandatory)_

### User Story 1 - User Sees an Overview of All Endpoints (Priority: P1)

An authenticated user lands on the dashboard after logging in and immediately
sees a summary of all their endpoints: how many they have, which are active,
recent activity, and the relay status.

**Why this priority**: The dashboard is the landing page and first impression after login. Users need an at-a-glance overview to understand their current state.

**Independent Test**: Log in with a user that has 3 endpoints (2 active, 1 inactive) with recent webhook activity. Verify the dashboard shows accurate counts and summaries.

**Acceptance Scenarios**:

1. **Given** I have 3 endpoints (2 active, 1 inactive), **When** I view the dashboard, **Then** I see summary statistics: "3 Endpoints", "2 Active", "1 Inactive"
2. **Given** my endpoints received 15 webhooks in the last 24 hours, **When** I view the dashboard, **Then** I see "15 Requests (24h)" or similar metric
3. **Given** the relay is connected, **When** I view the dashboard, **Then** I see the relay status indicator showing "Active"
4. **Given** I am a new user with no endpoints, **When** I view the dashboard, **Then** I see an onboarding message with a "Create Your First Endpoint" button

---

### User Story 2 - User Accesses Quick Actions from Dashboard (Priority: P1)

An authenticated user can perform common actions directly from the dashboard
without navigating to sub-pages: copy webhook URL, toggle active/inactive,
and view recent logs.

**Why this priority**: Quick access reduces friction and makes the tool efficient for daily use.

**Independent Test**: From the dashboard, copy a webhook URL, toggle an endpoint, and click to view logs — all without navigating away first.

**Acceptance Scenarios**:

1. **Given** the dashboard shows my endpoints, **When** I click the copy icon next to an endpoint, **Then** the webhook URL is copied to my clipboard and a toast confirms "URL copied"
2. **Given** the dashboard shows an active endpoint, **When** I click the toggle switch, **Then** the endpoint becomes inactive and the UI updates immediately (optimistic)
3. **Given** the dashboard shows an endpoint, **When** I click "View Logs", **Then** I am navigated to the log viewer filtered for that endpoint
4. **Given** the dashboard shows an endpoint, **When** I click the endpoint name, **Then** I am navigated to the endpoint detail/edit page

---

### User Story 3 - User Sees Recent Activity Feed (Priority: P2)

The dashboard shows the 10 most recent webhook events across all endpoints
as a compact activity feed, updating in real time.

**Why this priority**: Provides at-a-glance monitoring without entering the full log viewer.

**Independent Test**: Trigger a webhook and verify it appears in the dashboard activity feed within seconds.

**Acceptance Scenarios**:

1. **Given** I have recent webhook activity, **When** I view the dashboard, **Then** I see the 10 most recent events with: endpoint name, HTTP method, status badge, and relative time (e.g., "2 min ago")
2. **Given** a new webhook arrives, **When** I have the dashboard open, **Then** the activity feed updates in real time (new entry appears at top, oldest drops off if over 10)
3. **Given** I click an activity feed entry, **When** navigating, **Then** I am taken to the full log detail for that entry
4. **Given** I have no recent activity, **When** I view the dashboard, **Then** the activity feed shows "No recent activity"

---

### Edge Cases

- What happens when the user has many endpoints (20+)? The endpoint list should remain scrollable and performant
- What happens when the activity feed has entries from a just-deleted endpoint? Those entries should be hidden gracefully
- What happens when the "Requests (24h)" counter is calculated? It should be based on the actual received timestamp within the last 24 hours, not a fixed window

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a dashboard view as the default authenticated landing page
- **FR-002**: The dashboard MUST display summary statistics: total endpoints, active endpoints, inactive endpoints, and total requests received in the last 24 hours
- **FR-003**: The dashboard MUST display a list of all user endpoints as compact cards showing: name, webhook URL (copyable), active/inactive toggle, target configuration summary, and last activity timestamp
- **FR-004**: The dashboard MUST display the relay connection status indicator (reusing existing relay status component)
- **FR-005**: The dashboard MUST display a recent activity feed showing the 10 most recent webhook logs across all endpoints, with: endpoint name, HTTP method badge, status badge, and relative timestamp
- **FR-006**: The activity feed MUST update in real time when new webhooks arrive
- **FR-007**: Each endpoint card MUST provide quick actions: copy webhook URL, toggle active/inactive, navigate to logs, navigate to edit
- **FR-008**: For new users with zero endpoints, the dashboard MUST show an onboarding state with a "Create Your First Endpoint" call-to-action button
- **FR-009**: Summary statistics MUST be derived from the user's existing endpoint and log data
- **FR-010**: The dashboard layout MUST be responsive — multi-column on desktop, single-column on mobile

### Key Entities

- **Dashboard Summary**: Aggregated statistics (total endpoints, active count, inactive count, 24h request count)
- **Endpoint Card**: Compact representation of an endpoint with quick actions
- **Activity Feed**: Ordered list of recent webhook events across all endpoints

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Dashboard loads and displays all summary data within 2 seconds
- **SC-002**: Quick actions (copy URL, toggle active) complete without page navigation
- **SC-003**: Activity feed updates in real time within 2 seconds of new webhook events
- **SC-004**: New users see the onboarding state with a clear call-to-action
- **SC-005**: Dashboard is responsive and usable on both desktop and mobile viewports

## Assumptions

- The user is already authenticated before reaching the dashboard (auth is handled by existing routing/guards)
- Endpoint and log data is available from existing stores/APIs; no new backend endpoints are strictly required for basic summary stats
- The relay status component from the existing relay feature can be reused as-is
- The "Requests (24h)" metric counts all webhook logs with a received timestamp within the last 24 hours
- The activity feed shows a maximum of 10 entries; no pagination is needed for the feed itself
- Relative timestamps (e.g., "2 min ago") are computed client-side and refresh periodically
