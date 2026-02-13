# Quickstart: Dashboard

## Verification Scenarios

### Scenario 1: Summary Statistics Display

1. Log in with a user that has 3 endpoints (2 active, 1 inactive)
2. Navigate to the dashboard (`/dashboard`)
3. Verify summary cards show: "3 Endpoints", "2 Active", "1 Inactive"
4. Verify a "Requests (24h)" count is displayed (matches actual log count)

### Scenario 2: Onboarding Empty State

1. Log in with a new user that has zero endpoints
2. Navigate to the dashboard
3. Verify an onboarding message is displayed with "Create Your First Endpoint" button
4. Click the button — verify navigation to `/endpoints/new`

### Scenario 3: Endpoint Quick Actions

1. Log in with a user that has at least 1 active endpoint
2. On the dashboard, click the copy icon next to an endpoint
3. Verify the webhook URL is copied to the clipboard and a toast shows "URL copied"
4. Click the active/inactive toggle on an endpoint
5. Verify the toggle updates immediately (optimistic)
6. Click "View Logs" on an endpoint — verify navigation to `/logs` filtered for that endpoint
7. Click the endpoint name — verify navigation to `/endpoints/:id`

### Scenario 4: Activity Feed Display

1. Log in with a user that has recent webhook activity
2. Navigate to the dashboard
3. Verify the activity feed shows up to 10 recent events
4. Each entry should display: endpoint name, HTTP method badge, status badge, relative time
5. Click an activity entry — verify navigation to the log detail view

### Scenario 5: Activity Feed Real-Time Update

1. Open the dashboard in a browser
2. From another tab or tool, send a webhook to one of the user's endpoints
3. Verify the new webhook appears at the top of the activity feed within 2 seconds
4. If there were already 10 entries, verify the oldest drops off

### Scenario 6: Activity Feed Empty State

1. Log in with a user that has endpoints but no recent webhook activity
2. Navigate to the dashboard
3. Verify the activity feed shows "No recent activity"

### Scenario 7: Responsive Layout

1. Open the dashboard on a desktop-sized viewport
2. Verify endpoint list and activity feed are side by side (2 columns)
3. Resize to mobile viewport width
4. Verify layout stacks to single column
