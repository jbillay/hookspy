# Research: WebSocket Polling Fallback

**Feature**: 011-ws-polling-fallback | **Date**: 2026-02-28

## R-001: Missing `updated_at` Column on `webhook_logs`

**Decision**: Add an `updated_at` column with an auto-update trigger via a new Supabase migration.

**Rationale**: The polling fallback needs to detect both new rows (INSERTs) and status changes (UPDATEs). The `webhook_logs` table currently has `received_at` (set on insert) and `responded_at` (set when relay completes), but no general-purpose "last modified" timestamp. Status transitions to `forwarding`, `timeout`, and `error` have no associated timestamp column. A generic `updated_at` with a `BEFORE UPDATE` trigger covers all status transitions uniformly and enables a single efficient query for the polling endpoint.

**Alternatives considered**:

- Use `responded_at` as update indicator — rejected because it's only set for `responded` status, not for `forwarding`, `timeout`, or `error`.
- Poll by status (`WHERE status = 'pending'`) — rejected because it doesn't detect status transitions needed by the log-viewer and dashboard channels.
- Add a `modified_at` column — rejected in favor of the more conventional `updated_at` name.

**Implementation**: Migration adds `updated_at timestamptz DEFAULT now()` and creates a trigger function that sets `updated_at = now()` on every UPDATE. Add an index on `(endpoint_id, updated_at DESC)` for efficient polling queries.

## R-002: Polling Timestamp Column Mapping

**Decision**: Map spec terminology to actual database columns as follows:

- Spec's `created_at` → `received_at` (existing column, set on insert)
- Spec's `updated_at` → `updated_at` (new column from R-001)
- Initial poll cursor → captured at app-load time as an ISO timestamp

**Rationale**: The spec was written assuming `created_at`/`updated_at` columns exist. The actual schema uses `received_at` for row creation time. Rather than rename the existing column (which would break all existing queries), the polling endpoint maps accordingly.

**Alternatives considered**:

- Rename `received_at` to `created_at` — rejected due to breaking change across all existing queries, views, and API responses.

## R-003: Supabase Realtime WebSocket Failure Detection

**Decision**: Monitor the `.subscribe()` status callback across all channels managed by the transport composable. Count failures using a sliding window (30 seconds). After 3 failures within the window, switch to polling mode.

**Rationale**: The Supabase JS client's `.subscribe()` callback provides status values: `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`. Currently only the relay-worker channel monitors these. The transport composable centralizes this monitoring for all channels. A sliding window (vs. simple counter) prevents false positives from a single transient failure followed by minutes of stability.

**Alternatives considered**:

- Monitor WebSocket connection state directly on the Supabase client — rejected because the client doesn't expose a clean public API for transport-level health.
- Use a heartbeat/ping mechanism — rejected as over-engineering; the channel status callbacks are sufficient.

## R-004: Deduplication Strategy for Polling Mode

**Decision**: Use a Set of log IDs (last 100 seen) to deduplicate polled events against data already loaded during initial page fetch or previous polls.

**Rationale**: When switching from WS to polling with an app-load timestamp cursor, the first poll may return events already fetched by the initial data load. Similarly, overlapping poll windows could return the same event twice. A simple ID-based Set with bounded size (100 entries, matching max page size) handles both cases without complex timestamp arithmetic.

**Alternatives considered**:

- Timestamp-based dedup (skip events older than last processed) — rejected because clock precision issues could cause missed events at boundaries.
- No dedup (let stores handle it) — rejected because the relay store's `forwardWebhook` does optimistic locking (`UPDATE WHERE status='pending'`), which is safe, but the logs and dashboard stores would show duplicate entries.

## R-005: WebSocket Reconnect Probe While Polling

**Decision**: Every 60 seconds while in polling mode, create a test channel subscription. If it reaches `SUBSCRIBED` status within 10 seconds, switch all channels back to WebSocket mode and stop polling. If it fails or times out, clean up the test channel and continue polling.

**Rationale**: The test channel approach avoids disrupting active polling while probing WebSocket availability. A 10-second timeout per probe is generous enough for slow connections but doesn't block for too long.

**Alternatives considered**:

- Try reconnecting all channels at once — rejected because a failed reconnect would cause a gap in event delivery while channels are torn down and rebuilt.
- Use a raw WebSocket connection test — rejected because it bypasses Supabase's channel auth and wouldn't confirm that the full Realtime stack works.

## R-006: Existing Index Sufficiency for Polling Queries

**Decision**: Add a new composite index `idx_webhook_logs_endpoint_updated` on `(endpoint_id, updated_at DESC)` to support the UPDATE detection query. The existing `idx_webhook_logs_endpoint_received` on `(endpoint_id, received_at DESC)` is sufficient for the INSERT detection query.

**Rationale**: The polling endpoint runs two queries per poll cycle:

1. INSERTs: `WHERE received_at > $since AND endpoint_id = ANY($ids)` — covered by existing index.
2. UPDATEs: `WHERE updated_at > $since AND received_at <= $since AND endpoint_id = ANY($ids)` — needs the new index for efficient range scans on `updated_at`.

Without the index, the UPDATE query would do a sequential scan on all logs for the given endpoints, which degrades as log volume grows.

## R-007: Polling Endpoint Authorization Pattern

**Decision**: The polling endpoint validates that all requested `endpoint_ids` belong to the authenticated user by querying the `endpoints` table. If any ID doesn't belong to the user, the entire request is rejected with 403.

**Rationale**: Follows the authorization pattern already established in `api/logs/index.js` which uses `endpoints!inner(user_id)` joins. The polling endpoint performs an explicit ownership check rather than relying on RLS because it uses the service-role client (which bypasses RLS).

**Alternatives considered**:

- Use the anon key with RLS instead of service role — rejected because the existing API pattern uses service role consistently, and mixing would add confusion.
- Filter out non-owned IDs silently — rejected because silent filtering could mask bugs where the client sends wrong IDs.
