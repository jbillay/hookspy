# Research: Log Viewer

## Decision 1: DataTable Component for Log List

**Decision**: Use PrimeVue DataTable with row expansion for the log list.

**Rationale**: PrimeVue DataTable supports expandable rows natively via `v-model:expandedRows` and the `#expansion` template slot. This aligns perfectly with the spec requirement for inline expandable log details. DataTable also provides built-in pagination, sorting, and column templating. PrimeVue 4.5.4 is already installed in the project.

**Alternatives considered**:

- Custom card-based list (current pattern for endpoints): Lacks built-in pagination, sorting, and expansion. Would require significant custom code.
- Third-party table library: Unnecessary — PrimeVue DataTable is already available and feature-rich.

## Decision 2: JSON Syntax Highlighting

**Decision**: Use CSS-based syntax highlighting with a simple custom tokenizer. Apply colored spans for JSON keys, strings, numbers, booleans, and null values.

**Rationale**: A lightweight CSS-based approach avoids adding a dependency for a simple use case (JSON only). The tokenizer can be ~30 lines of code. PrimeVue's existing theme colors provide a consistent palette.

**Alternatives considered**:

- highlight.js / Prism.js: Full-featured but heavyweight for JSON-only highlighting. Adds bundle size.
- `<pre>` with `JSON.stringify(obj, null, 2)`: No color highlighting — doesn't meet FR-009.

## Decision 3: Real-Time Updates via Supabase Realtime

**Decision**: Use Supabase Realtime `postgres_changes` subscription for both INSERT (new logs) and UPDATE (status changes) events on `webhook_logs`, filtered by the user's endpoint IDs.

**Rationale**: The relay store (006) already subscribes to INSERT events on `webhook_logs`. The log viewer needs both INSERT (new entries) and UPDATE (status transitions). The existing pattern from `src/stores/relay.js` provides a proven reference. The compound index on `(endpoint_id, received_at DESC)` ensures efficient filtering.

**Alternatives considered**:

- Polling API: Higher latency, unnecessary server load. Supabase Realtime is already configured and proven in the relay feature.
- Sharing the relay store's channel: Would couple the relay and log viewer lifecycle unnecessarily. Separate subscriptions are cleaner.

## Decision 4: Log Detail View as Expandable Row

**Decision**: Implement log details as an expandable inline row using PrimeVue DataTable's `#expansion` template slot. Clicking a row expands it to show request/response side by side.

**Rationale**: Confirmed in clarification session. Keeps list context visible, natural debugging flow. PrimeVue DataTable natively supports this pattern with `v-model:expandedRows` and `Column expander`.

**Alternatives considered**:

- Separate page (`/logs/:id`): Loses list context, requires navigation back and forth.
- Sidebar/dialog: Limits display area for side-by-side request/response layout.

## Decision 5: API Pagination Pattern

**Decision**: Use offset-based pagination with `page` and `limit` query parameters. Return `{ data, total }` to support traditional numbered page controls.

**Rationale**: The spec requires traditional numbered page controls (FR-013). Offset pagination with total count is the simplest pattern that supports page number display. The existing `idx_webhook_logs_endpoint_received` index on `(endpoint_id, received_at DESC)` makes offset queries efficient for the expected data volume (24h retention).

**Alternatives considered**:

- Cursor-based pagination: More efficient for very large datasets but complicates page number display and random page access. Overkill for 24h-retained data.

## Decision 6: Logs Store Real-Time Integration

**Decision**: The logs Pinia store manages its own Supabase Realtime subscription, separate from the relay store. It subscribes when the log view mounts and unsubscribes when it unmounts.

**Rationale**: The relay store and log viewer have different lifecycles and needs. The relay store runs as long as the user is authenticated (via RelayWorker in AppLayout). The log viewer subscription should only be active when viewing logs. Separate subscriptions avoid coupling.

**Alternatives considered**:

- Sharing a single channel between relay and logs stores: Complex lifecycle management, tight coupling between unrelated features.

## Decision 7: Body Truncation Strategy

**Decision**: For bodies over 100KB, display the first 100KB with a "Show full body" toggle button. When toggled, render the complete body. Use `text.length > 102400` as the threshold check.

**Rationale**: 100KB is the threshold specified in the spec (FR-010). Character count is a reasonable proxy for display size. The toggle avoids DOM performance issues from rendering very large strings on initial load.

**Alternatives considered**:

- Virtual scrolling for large bodies: Complex to implement for text content, unnecessary for the expected use case.
- Download as file: Less convenient for debugging workflows where the user wants to inspect inline.
