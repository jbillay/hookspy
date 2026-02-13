# Research: Dashboard

## Decision 1: Dashboard data source for summary statistics

**Decision**: Compute summary stats client-side from the existing endpoints store. For the 24h request count, add a lightweight API call or use the existing GET /api/logs with `limit=0` to get just the `total` count.

**Rationale**: The endpoints store already holds all user endpoints (fetched on app init). Active/inactive/total counts are trivial computed properties. The logs API already supports date filtering (`from` param) and returns `total` in the response — we can call `GET /api/logs?limit=1&from=<24h-ago>` to get the count without loading full log data.

**Alternatives considered**:

- Dedicated `/api/dashboard/stats` endpoint — over-engineered for a few numbers; adds API surface unnecessarily
- Supabase RPC for server-side aggregation — adds migration complexity for minimal gain

## Decision 2: Activity feed data source

**Decision**: Use the existing logs store with a separate instance or isolated fetch. Call `GET /api/logs?limit=10` to get the 10 most recent logs across all endpoints. Subscribe to Supabase Realtime for live updates (same pattern as LogList).

**Rationale**: The logs API already supports pagination and returns endpoint names via the join. The Realtime subscription pattern is proven in LogList.vue. We need a separate Realtime channel to avoid conflicting with the full LogsView if both are open.

**Alternatives considered**:

- Reuse the logs store directly — risks state conflicts if user navigates between dashboard and logs view with different filters
- Dedicated activity feed API — unnecessary, existing API covers the need

## Decision 3: Endpoint card reuse vs. new dashboard card

**Decision**: Create a new `DashboardEndpointCard` component rather than reusing `EndpointCard.vue`. The dashboard card is more compact (no delete, no timeout display, no full target details) and adds quick actions (copy URL, view logs link) that the existing card doesn't have.

**Rationale**: The existing EndpointCard is designed for the endpoints management view with edit/delete actions. The dashboard card has a different layout and action set. Forcing the existing card to serve both use cases would add excessive conditional logic.

**Alternatives considered**:

- Reuse EndpointCard with slots/props for dashboard mode — the layout differences are too significant; conditional rendering would make the component harder to maintain
- Extend EndpointCard — dashboard needs copy URL and view logs but not edit/delete; different enough to warrant a separate component

## Decision 4: Realtime subscription strategy for activity feed

**Decision**: Use a dedicated Supabase Realtime channel named `dashboard-activity` that subscribes to INSERT events on `webhook_logs` for all user endpoint IDs. Maintain a local array of 10 entries, prepending new ones and trimming to 10.

**Rationale**: Mirrors the proven pattern in the logs store but with a separate channel name to avoid conflicts. The dashboard may be open simultaneously with the log viewer, so separate channels prevent interference.

**Alternatives considered**:

- Share the logs store subscription — causes filter conflicts and state pollution between views
- Poll every N seconds — unnecessary given existing Realtime infrastructure

## Decision 5: Relative time formatting

**Decision**: Use a simple utility function (`formatTimeAgo`) that computes relative time strings ("just now", "2 min ago", "1 hour ago", "3 hours ago"). Refresh via a 60-second interval timer.

**Rationale**: No external dependency needed for a simple relative time formatter. A 60-second refresh interval keeps the display reasonably current without excessive re-renders.

**Alternatives considered**:

- `date-fns` or `dayjs` — adds a dependency for a single function; overkill
- Vue computed with `Date.now()` reactivity — doesn't auto-update without a timer

## Decision 6: Onboarding empty state

**Decision**: When the user has zero endpoints, replace the entire dashboard content with a centered onboarding card containing a welcome message and a "Create Your First Endpoint" button that navigates to `/endpoints/new`.

**Rationale**: A focused onboarding state prevents confusion for new users seeing an empty dashboard. The button provides a clear call-to-action.

**Alternatives considered**:

- Show empty dashboard sections with individual "no data" messages — fragmented and confusing for new users
- Modal onboarding wizard — over-engineered for a simple redirect to endpoint creation

## Decision 7: Dashboard layout structure

**Decision**: Use a grid layout with summary stats row at top (4 stat cards), endpoint list and activity feed side by side below (2 columns on desktop, stacked on mobile). Relay status is already shown in the AppHeader.

**Rationale**: The summary stats row gives an immediate overview. Side-by-side layout maximizes information density on desktop while gracefully stacking on mobile via Tailwind responsive classes.

**Alternatives considered**:

- Single-column layout — wastes horizontal space on desktop
- Tabs for endpoints vs. activity — hides information, adds clicks
