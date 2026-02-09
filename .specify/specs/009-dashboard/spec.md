# Feature Specification: Dashboard

**Feature Branch**: `009-dashboard`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Overview dashboard with endpoint summaries and quick actions

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Sees an Overview of All Endpoints (Priority: P1)

An authenticated user lands on the dashboard after logging in and immediately
sees a summary of all their endpoints: how many they have, which are active,
recent activity, and the relay status.

**Why this priority**: The dashboard is the landing page and first impression after login.

**Independent Test**: Log in with a user that has 3 endpoints (2 active, 1 inactive)
with recent webhook activity. Verify the dashboard shows accurate counts and summaries.

**Acceptance Scenarios**:

1. **Given** I have 3 endpoints (2 active, 1 inactive), **When** I view the dashboard, **Then** I see summary cards: "3 Endpoints", "2 Active", "1 Inactive"
2. **Given** my endpoints received 15 webhooks in the last 24 hours, **When** I view the dashboard, **Then** I see "15 Requests Today" (or similar metric)
3. **Given** the relay is connected, **When** I view the dashboard, **Then** I see the relay status indicator showing "Active"
4. **Given** I am a new user with no endpoints, **When** I view the dashboard, **Then** I see an onboarding message with a "Create Your First Endpoint" button

---

### User Story 2 - User Accesses Quick Actions from Dashboard (Priority: P1)

An authenticated user can perform common actions directly from the dashboard
without navigating to sub-pages: copy webhook URL, toggle active/inactive,
and view recent logs.

**Why this priority**: Quick access reduces friction and makes the tool efficient.

**Independent Test**: From the dashboard, copy a webhook URL, toggle an endpoint,
and click to view logs — all without navigating away first.

**Acceptance Scenarios**:

1. **Given** the dashboard shows my endpoints, **When** I click the copy icon next to an endpoint, **Then** the webhook URL is copied to my clipboard and a toast confirms "URL copied"
2. **Given** the dashboard shows an active endpoint, **When** I click the toggle switch, **Then** the endpoint becomes inactive and the UI updates immediately
3. **Given** the dashboard shows an endpoint, **When** I click "View Logs", **Then** I am navigated to the log viewer for that endpoint
4. **Given** the dashboard shows an endpoint, **When** I click the endpoint name, **Then** I am navigated to the endpoint detail/edit page

---

### User Story 3 - User Sees Recent Activity Feed (Priority: P2)

The dashboard shows the 10 most recent webhook events across all endpoints
as a compact activity feed, updating in real time.

**Why this priority**: Provides at-a-glance monitoring without entering the full log viewer.

**Independent Test**: Trigger a webhook and verify it appears in the dashboard
activity feed within 1 second.

**Acceptance Scenarios**:

1. **Given** I have recent webhook activity, **When** I view the dashboard, **Then** I see the 10 most recent events with: endpoint name, method, status badge, and time ago (e.g., "2 min ago")
2. **Given** a new webhook arrives, **When** I have the dashboard open, **Then** the activity feed updates in real time (new entry at top, oldest drops off)
3. **Given** I click an activity feed entry, **When** navigating, **Then** I am taken to the full log detail view for that entry
4. **Given** I have no recent activity, **When** I view the dashboard, **Then** the activity feed shows "No recent activity"

---

### Edge Cases

- What happens when the user has many endpoints (20+)? Dashboard should show a scrollable list or paginate
- What happens when the activity feed has entries from a just-deleted endpoint? Hide those entries gracefully
- What happens during the first 24 hours with pg_cron cleanup? "Requests Today" counter should be based on `received_at` within the last 24h

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dashboard view at `/` (root route) as the default authenticated page
- **FR-002**: The dashboard MUST display summary statistics: total endpoints, active endpoints, inactive endpoints, total requests in the last 24 hours
- **FR-003**: The dashboard MUST display a list of all user endpoints as compact cards with: name, webhook URL (copyable), active/inactive toggle, target configuration summary, last activity timestamp
- **FR-004**: The dashboard MUST display the relay status indicator (reusing `RelayStatus.vue` from the relay spec)
- **FR-005**: The dashboard MUST display a recent activity feed showing the 10 most recent webhook logs across all endpoints, with: endpoint name, method badge, status badge, and relative timestamp
- **FR-006**: The activity feed MUST update in real time via Supabase Realtime
- **FR-007**: Each endpoint card MUST provide quick actions: copy webhook URL, toggle active/inactive, navigate to logs, navigate to edit
- **FR-008**: For new users with zero endpoints, the dashboard MUST show an onboarding state with a "Create Your First Endpoint" call-to-action button
- **FR-009**: Summary statistics MUST be fetched via an API endpoint or computed from the endpoints and logs stores
- **FR-010**: The dashboard layout MUST use PrimeVue Card components with Tailwind CSS for responsive grid layout (2 columns on desktop, 1 on mobile)

### Key Entities

- **DashboardView**: The main view component at the root route
- **EndpointCard**: Compact card showing endpoint summary with quick actions
- **ActivityFeed**: Recent webhook events list

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dashboard loads within 2 seconds showing all summary data
- **SC-002**: Quick actions (copy URL, toggle active) work without page navigation
- **SC-003**: Activity feed updates in real time within 1 second of new webhook events
- **SC-004**: New users see the onboarding state with clear call-to-action
- **SC-005**: Dashboard is responsive and usable on both desktop and mobile viewports
