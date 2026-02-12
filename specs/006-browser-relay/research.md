# Research: Browser Relay Engine

**Feature**: 006-browser-relay
**Date**: 2026-02-12

## Decision 1: Supabase Realtime Subscription Pattern

**Decision**: Use `postgres_changes` with `INSERT` event on `webhook_logs` table, filtered by `endpoint_id=in.(id1,id2,...)`.

**Rationale**: Supabase Realtime supports the `in` filter operator, allowing a single channel subscription to cover all of the user's active endpoints. This avoids creating one channel per endpoint and simplifies lifecycle management.

**Pattern**:

```javascript
const channel = client.channel('relay-worker')
channel.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'webhook_logs',
    filter: `endpoint_id=in.(${activeEndpointIds.join(',')})`,
  },
  (payload) => {
    // payload.new contains the inserted webhook_log row
  },
)
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    /* relay active */
  }
  if (status === 'CHANNEL_ERROR') {
    /* handle error */
  }
  if (status === 'TIMED_OUT') {
    /* handle timeout */
  }
  if (status === 'CLOSED') {
    /* handle close */
  }
})
```

**Alternatives considered**:

- One channel per endpoint: More granular but unnecessary overhead; single channel with `in` filter is cleaner.
- Broadcast channel: Not applicable — we need CDC from the database, not pub/sub messaging.

## Decision 2: Multi-Tab Deduplication Strategy

**Decision**: Use optimistic status update as a claim mechanism. Before forwarding, the relay updates the webhook log status from `pending` to `forwarding` via the existing response endpoint. If the status is already `forwarding` or later, skip the webhook.

**Rationale**: This leverages the existing `POST /api/logs/:id/response` endpoint's idempotency check (returns 409 for already-resolved logs). No leader election or localStorage coordination needed.

**Implementation approach**:

1. On receiving a Realtime INSERT event, check `payload.new.status === 'pending'`.
2. Immediately POST to `/api/logs/:id/response` with a "claim" — but actually, the response endpoint expects either `{ status, headers, body }` or `{ error }`. The `forwarding` status update needs a different mechanism.
3. Better approach: Use a direct Supabase update from the client (via anon key + RLS) to set `status = 'forwarding'` with a condition `WHERE status = 'pending'`. If 0 rows affected, another tab already claimed it.

**Revised decision**: Use a conditional Supabase update (optimistic locking) to claim the webhook. The anon client updates `webhook_logs` with `status = 'forwarding'` only where `status = 'pending'`. RLS policy must allow the user to update their own logs' status.

**Alternatives considered**:

- localStorage-based leader election: Complex, fragile across tab crashes.
- BroadcastChannel API: Requires coordination logic; overkill for this use case.
- Let all tabs forward (dedup at server): Wastes local server resources.

## Decision 3: Fetch API Forbidden Headers

**Decision**: Silently skip browser-restricted headers when constructing the forwarding request.

**Rationale**: The Fetch API specification defines a set of "forbidden" request headers that cannot be set programmatically. These include: `Accept-Charset`, `Accept-Encoding`, `Access-Control-Request-Headers`, `Access-Control-Request-Method`, `Connection`, `Content-Length`, `Cookie`, `Cookie2`, `Date`, `DNT`, `Expect`, `Host`, `Keep-Alive`, `Origin`, `Referer`, `Set-Cookie`, `TE`, `Trailer`, `Transfer-Encoding`, `Upgrade`, `Via`, and headers starting with `Proxy-` or `Sec-`.

**Implementation**: Filter the `request_headers` object before passing to `fetch()`, removing any keys matching the forbidden list. No user-facing warning needed (documented as known limitation).

**Alternatives considered**:

- Log skipped headers in webhook detail: Adds noise; developers familiar with fetch API understand this limitation.
- Proxy through server to avoid restriction: Violates Browser-as-Bridge principle.

## Decision 4: Reconnection Strategy

**Decision**: Rely on Supabase Realtime's built-in reconnection with status monitoring.

**Rationale**: The Supabase JS client's Realtime channels have built-in reconnection logic. The relay composable monitors channel status via the `subscribe()` callback and updates the relay status indicator accordingly. When status changes to `CHANNEL_ERROR` or `CLOSED`, the composable unsubscribes and resubscribes after a brief delay. Supabase handles the underlying WebSocket reconnection.

**Reconnection flow**:

1. Channel status changes to `CHANNEL_ERROR` or `CLOSED` → set relay status to "Inactive"
2. Wait 1-2 seconds, then call `channel.unsubscribe()` followed by `channel.subscribe()`
3. On `SUBSCRIBED` → set relay status to "Active"
4. If repeated failures, use exponential backoff (1s, 2s, 4s, 8s, max 30s)

**Alternatives considered**:

- Custom WebSocket management: Unnecessary; Supabase handles this.
- No reconnection (require page reload): Poor UX.

## Decision 5: RLS Policy for Status Update

**Decision**: Add an RLS policy allowing authenticated users to update `webhook_logs.status` for logs belonging to their endpoints.

**Rationale**: The multi-tab deduplication strategy requires the browser to update `status` from `pending` to `forwarding` directly via the Supabase client (not through a server endpoint). This requires an UPDATE RLS policy that allows the authenticated user to modify logs for endpoints they own.

**Policy**:

```sql
CREATE POLICY "Users can update status on own webhook logs"
  ON webhook_logs FOR UPDATE
  USING (endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid()))
  WITH CHECK (endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid()));
```

**Note**: This policy should be scoped to only allow updating the `status` column to `forwarding`. However, Postgres RLS doesn't support column-level restrictions in policies. The application logic will enforce that only `status` is updated.

**Alternatives considered**:

- Server-side claim endpoint: Adds latency; an extra round trip before forwarding defeats the <1s target.
- No claim mechanism: Allows duplicate forwarding from multiple tabs.

## Decision 6: Composable vs Store Architecture

**Decision**: Create a `useRelayStore` Pinia store for state and a `use-relay.js` composable as a thin wrapper, following established project patterns.

**Rationale**: The project convention is composables as thin wrappers over Pinia stores. The relay store holds: `relayStatus` (ref), `activeChannel` (ref), `forwardingCount` (ref). The store exposes actions: `startRelay()`, `stopRelay()`, `updateSubscription()`, `forwardWebhook()`.

**Alternatives considered**:

- Composable-only (no Pinia store): Breaks established pattern; state wouldn't be accessible from other components.
- Global event bus: Anti-pattern in Vue 3.

## Decision 7: Where to Mount RelayWorker

**Decision**: Mount `RelayWorker.vue` inside `AppLayout.vue`, conditionally rendered when the user is authenticated.

**Rationale**: The relay must run whenever the user is logged in and viewing any page, not just specific views. `AppLayout.vue` already handles auth-conditional rendering for the header. The RelayWorker renders no visible UI (empty `<template>` with just the setup logic) and manages the Realtime subscription lifecycle via `onMounted`/`onUnmounted`.

**Alternatives considered**:

- Mount in `App.vue`: Would run before auth is initialized.
- Mount in each view: Redundant, would cause subscribe/unsubscribe on navigation.
