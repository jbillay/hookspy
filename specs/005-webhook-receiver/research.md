# Research: Webhook Receiver

**Feature**: 005-webhook-receiver | **Date**: 2026-02-10

## Decision 1: Polling Strategy in Serverless Functions

**Decision**: Use a simple `setInterval`/`setTimeout` loop within the serverless function handler to poll Supabase every 500ms for log status changes.

**Rationale**: Vercel serverless functions support long-running handlers up to 60s (on Pro plan, 10s on Hobby). The function keeps the HTTP connection open while polling. This is the simplest approach that works within the serverless model — no WebSocket connections, no external queue, no background workers.

**Alternatives considered**:

- **Supabase Realtime subscription in the function**: Rejected. Serverless functions are stateless; maintaining a Realtime WebSocket connection adds complexity and may not clean up properly on timeout.
- **External queue (Redis pub/sub, SQS)**: Rejected. Adds infrastructure dependency; violates Simplicity principle. Polling at 500ms is adequate for a dev tool.
- **Long polling with Supabase RPC**: Considered. Would require a custom Postgres function with `pg_notify`. Added complexity for marginal latency improvement over 500ms polling.

## Decision 2: Rate Limiting Approach

**Decision**: Use in-memory rate limiting with a simple Map tracking request counts per slug per minute window. Counts reset on each new minute boundary.

**Rationale**: Serverless functions are stateless, so in-memory rate limiting is per-instance only. For a single-user dev tool with low concurrency, this provides adequate protection against accidental flooding. It doesn't require external storage (Redis) or database writes for rate tracking.

**Alternatives considered**:

- **Database-backed rate limiting**: Rejected. Adds a write + read to every webhook request just for rate checking. Too heavy for the expected scale.
- **Vercel Edge Config / KV**: Rejected. Adds dependency on Vercel-specific features; increases cost and complexity.
- **No rate limiting**: Rejected per clarification decision. The endpoint is public and unauthenticated.

**Limitation acknowledged**: In-memory counters do not persist across serverless cold starts or multiple instances. This is acceptable for the current scale. If the product grows, database-backed rate limiting can be added later.

## Decision 3: Request Body Size Validation

**Decision**: Check `Content-Length` header and/or accumulated body size before storing. Reject with 413 if body exceeds 1MB.

**Rationale**: Vercel's default body size limit for serverless functions is 4.5MB. The 1MB limit is more conservative, protecting the database from oversized payloads. Checking `Content-Length` first allows fast rejection without reading the full body.

**Alternatives considered**:

- **Rely on Vercel's built-in limit only**: Rejected. 4.5MB is too generous; could fill the database quickly under abuse.
- **Stream and truncate**: Rejected. Violates Full HTTP Fidelity principle — bodies must not be modified.

## Decision 4: Raw Body Access in Vercel Functions

**Decision**: Configure `api/hook/[slug].js` to disable Vercel's automatic body parsing by exporting `export const config = { api: { bodyParser: false } }`. Read the raw body manually using stream consumption.

**Rationale**: The spec requires storing the exact raw body as received. Vercel's default body parser parses JSON and form-encoded bodies, which transforms the data. Disabling it preserves the original bytes. For the response submission endpoint, default parsing is fine since we control the format.

**Alternatives considered**:

- **Use parsed body and re-serialize**: Rejected. Re-serialization may not produce identical output (key ordering, whitespace). Violates Full HTTP Fidelity.
- **Use `req.body` as-is**: Rejected. Vercel parses JSON bodies by default, losing the raw string representation.

## Decision 5: Handling the `forwarding` Status

**Decision**: The webhook receiver polling loop checks for any status change from `pending` (not just `responded`). The `forwarding` status is an intermediate state set by the browser relay when it picks up the log, before it has the response. The polling loop continues waiting when status is `forwarding`.

**Rationale**: The status lifecycle is `pending` → `forwarding` → `responded` | `error`. The receiver needs to wait through both `pending` and `forwarding` states. Only `responded`, `error`, or timeout should terminate the polling loop.

**Alternatives considered**:

- **Only check for `responded`**: Rejected. Would miss `error` status from the browser relay, causing unnecessary timeout waits.
- **Terminate on `forwarding`**: Rejected. `forwarding` means the browser picked it up but hasn't gotten the local server response yet.

## Decision 6: Vercel Function Configuration

**Decision**: Set `maxDuration` in the function's config export to allow up to 60s execution. The endpoint's `timeout_seconds` (max 55s) controls the actual polling duration within the function.

**Rationale**: The 5s margin between the endpoint timeout (55s max) and the function limit (60s) ensures the function has time to update the log status to `timeout` and return a proper 504 response before Vercel terminates it.

**Alternatives considered**:

- **Default 10s function timeout**: Rejected. Most webhook relay round-trips take 1-10s, but the function must support configurable timeouts up to 55s.
