# Research: Replay & Search

## Decision 1: Replay API Design

**Decision**: Create `POST /api/logs/:id/replay` endpoint that copies request data from the original log into a new `webhook_logs` record with `status: 'pending'`.

**Rationale**: The existing relay mechanism already detects new `pending` logs via Supabase Realtime INSERT events. By creating a new log record with the original's request data, the replay is automatically forwarded by the relay without any changes to the relay store. This is the simplest approach — no new forwarding logic needed.

**Alternatives considered**:

- Client-side replay (browser directly calls local server with copied data): rejected because it bypasses the logging pipeline and wouldn't create a proper log trail
- Server-side replay (serverless function calls local server): impossible because the server can't reach localhost

## Decision 2: Replay Reference Column

**Decision**: Add `replayed_from` column (uuid, nullable, FK to webhook_logs) via a new Supabase migration.

**Rationale**: A simple nullable foreign key is the lightest way to track replay lineage. When null, the log is an original webhook. When set, the UI shows a replay badge. Chain replays naturally work — each replay points to its immediate parent. No recursive queries needed for the current feature scope.

**Alternatives considered**:

- Boolean `is_replay` flag: doesn't provide lineage tracking
- Separate `replay_metadata` JSONB column: over-engineered for a single reference

## Decision 3: Text Search Approach

**Decision**: Use PostgreSQL `ILIKE` with `OR` across `request_body`, `request_url`, `response_body`, and `error_message` columns. Wrap the search term in `%` wildcards for substring matching.

**Rationale**: Given the 24-hour log retention and typical usage (< 1000 logs per user), `ILIKE` is sufficient for substring search without the complexity of full-text search indexes. The Supabase client supports `.or()` with `.ilike()` filters. Performance target of 500ms is easily met with this data volume.

**Alternatives considered**:

- PostgreSQL full-text search (`to_tsvector`/`to_tsquery`): overkill for small datasets and substring matching; FTS is word-based, not substring-based
- `pg_trgm` trigram extension: excellent for fuzzy substring search but requires extension setup and is unnecessary given small data volume
- Client-side filtering: rejected because it requires loading all logs into the browser

## Decision 4: Filter Query Parameter Design

**Decision**: Extend `GET /api/logs` with query parameters: `method` (comma-separated), `status` (comma-separated), `from` (ISO 8601 date), `to` (ISO 8601 date), `q` (search text). All filters are AND-ed.

**Rationale**: Comma-separated values for multi-select filters are simple to parse and URL-friendly. ISO dates are unambiguous. Using `q` for text search follows common API conventions. All params are optional and backward-compatible with existing callers.

**Alternatives considered**:

- Array params (`method[]=GET&method[]=POST`): more complex parsing on Vercel
- POST body for filters: breaks bookmarkability and REST conventions

## Decision 5: URL Query String Sync for Filters

**Decision**: Use Vue Router's `query` object to sync filter state. On mount, LogList reads filters from `route.query`. On filter change, push updated query params via `router.replace()`. The logs store reads filter state from the component, not from the URL directly.

**Rationale**: Vue Router query params are the natural mechanism for URL-synced state in a Vue SPA. Using `router.replace()` (not `push`) prevents polluting browser history with every filter change. The store remains URL-agnostic — the component bridges between URL and store.

**Alternatives considered**:

- Store reads from URL directly: couples Pinia to Vue Router, making store harder to test
- Custom URLSearchParams management: reinvents what Vue Router already provides

## Decision 6: Search Debounce

**Decision**: Debounce text search input by 300ms before triggering API calls. Method/status/date filters apply immediately on change.

**Rationale**: 300ms debounce prevents excessive API calls while typing but feels responsive. Dropdown and date picker changes are discrete user actions that should apply immediately.

**Alternatives considered**:

- No debounce (search on every keystroke): too many API calls
- Search on explicit submit (Enter key): less discoverable and feels sluggish for modern UX
- 500ms debounce: too slow, feels unresponsive

## Decision 7: Realtime + Filters Interaction

**Decision**: When filters are active and a new webhook arrives via Realtime INSERT, apply client-side filter matching before adding to the visible list. If the new log doesn't match active filters, skip adding it.

**Rationale**: The Realtime subscription already receives all INSERT events for the user's endpoints. Rather than ignoring Realtime when filters are active (which would break the live-updating experience), we do a lightweight client-side check: does the new log match the current method/status/search filters? If yes, prepend it; if no, skip it but still increment the total count.

**Alternatives considered**:

- Disable Realtime when filters active: breaks the real-time experience that's core to HookSpy
- Re-fetch on every INSERT event: wasteful and introduces latency
