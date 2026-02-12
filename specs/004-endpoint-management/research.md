# Research: Endpoint Management

**Feature**: 004-endpoint-management
**Date**: 2026-02-09

## Decision Log

### 1. Slug Generation Strategy

**Decision**: Generate 8-character hex slug from the first 8 chars of a UUID v4 (without hyphens).

**Rationale**: UUIDs provide sufficient entropy for a developer tool. 8 hex chars = 4 billion combinations, more than enough. Simple to implement with `crypto.randomUUID().replace(/-/g, '').slice(0, 8)`.

**Alternatives considered**:

- nanoid: Additional dependency for marginal benefit
- Full UUID as slug: Too long for URLs
- User-defined slugs: Added complexity for little value; auto-generation is simpler

### 2. Custom Headers Storage Format

**Decision**: Store as JSONB object `{"Header-Name": "value", ...}` in the `custom_headers` column.

**Rationale**: The database already defines `custom_headers jsonb DEFAULT '{}'`. A flat key-value object is the simplest representation, maps directly to HTTP headers, and is easy to merge with incoming request headers at relay time. Duplicate header keys are not supported (last-write-wins), which aligns with HTTP semantics for most headers.

**Alternatives considered**:

- Array of `{key, value}` objects: More complex to query, no benefit for this use case
- Separate headers table: Over-normalized; JSONB is sufficient for a small set of custom headers

### 3. API Route Structure

**Decision**: Follow Vercel file-based routing with `api/endpoints/index.js` (GET list + POST create) and `api/endpoints/[id].js` (GET single + PUT update + DELETE).

**Rationale**: Matches CLAUDE.md structure exactly. Method switching inside each handler is the standard Vercel pattern. Uses the service role Supabase client to bypass RLS for server-side operations (auth validated via JWT first).

**Alternatives considered**:

- Separate files per method: Vercel doesn't support this natively
- API middleware framework: Over-engineered for 2 route files

### 4. CORS Helper

**Decision**: Create `api/_lib/cors.js` with a `setCorsHeaders(res)` function and an OPTIONS preflight handler.

**Rationale**: The frontend SPA calls the API from the same domain (Vercel), so CORS is primarily needed for local development (`localhost:5173` → `localhost:3000` or Vercel API). A shared helper avoids repetition across all API files.

**Alternatives considered**:

- Vercel `vercel.json` headers config: Less flexible, can't conditionally set origin
- No CORS helper: Would require duplicating headers in every API file

### 5. Endpoints Pinia Store Pattern

**Decision**: Follow the same Composition API pattern as `stores/auth.js` — `defineStore('endpoints', () => {})` with `ref()` state, async CRUD methods, and `{ data, error }` return convention.

**Rationale**: Consistency with existing codebase. The store fetches from the API using the Supabase client's `session.access_token` for auth. Loading and error states managed per-operation.

**Alternatives considered**:

- Direct Supabase client calls from components: Bypasses the store pattern, loses centralized state
- Options API store: Inconsistent with existing auth store

### 6. Form Component Reuse (Create vs Edit)

**Decision**: Single `EndpointForm.vue` component used by `EndpointDetailView.vue`. The view passes a `mode` prop (`'create'` or `'edit'`) and optional existing endpoint data. The form handles defaults for create mode.

**Rationale**: Avoids duplicating form fields, validation logic, and header injection editor. The only differences are: create mode has empty defaults and submits POST; edit mode pre-populates and submits PUT.

**Alternatives considered**:

- Separate create and edit forms: Code duplication
- Single view with route-based mode detection: This is effectively what we're doing — `EndpointDetailView.vue` detects `/endpoints/new` vs `/endpoints/:id`

### 7. Active/Inactive Toggle UX

**Decision**: Use a PrimeVue ToggleSwitch directly on the EndpointCard in the list view. Toggle immediately calls the API to update `is_active` without navigating to the edit page.

**Rationale**: Quick toggle is the primary UX goal (Story 5). Going through the edit form for a single boolean is too many clicks. Optimistic update with error rollback provides instant feedback.

**Alternatives considered**:

- Toggle only in edit view: Too cumbersome for a quick action
- Dropdown menu with "Activate/Deactivate": Extra click for no benefit
