# Research: Authentication

**Feature**: 003-authentication
**Date**: 2026-02-09

## Decision Log

### 1. Auth Provider API

**Decision**: Use Supabase Auth v2 client methods (`signUp`, `signInWithPassword`, `signOut`, `getSession`, `getUser`, `onAuthStateChange`).

**Rationale**: Supabase Auth is already the project's auth provider (per constitution). The v2 API follows a consistent `{ data, error }` return pattern and handles session persistence automatically via localStorage with auto-refresh.

**Alternatives considered**:

- Custom JWT auth — rejected; unnecessary complexity when Supabase Auth handles everything
- Firebase Auth — rejected; not aligned with project tech stack

### 2. State Management Pattern

**Decision**: Use a Pinia store (`stores/auth.js`) for global auth state, with a thin `useAuth` composable that wraps the store for component consumption.

**Rationale**: CLAUDE.md specifies Pinia for global state and composables for reusable logic. The store holds reactive `user`, `session`, and `loading` state. The composable provides a clean API with `signIn`, `signUp`, `signOut`, and `initAuth` actions.

**Alternatives considered**:

- Composable-only (no store) — rejected; auth state is global and must be shared across routes and components
- Provide/inject — rejected; less testable than Pinia

### 3. Session Initialization

**Decision**: Call `supabase.auth.getSession()` on app startup (in `main.js` or root component), then subscribe to `onAuthStateChange` for reactive updates.

**Rationale**: `getSession()` reads from localStorage (fast, no network call) and returns the persisted session. `onAuthStateChange` emits `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, and `TOKEN_REFRESHED` events that keep the Pinia store in sync. The subscription must be cleaned up on app unmount.

**Alternatives considered**:

- Only use `getUser()` on startup — rejected; makes a network call and is slower for initial render
- Poll for session changes — rejected; `onAuthStateChange` is event-driven and more efficient

### 4. Server-Side JWT Verification

**Decision**: Create `api/_lib/auth.js` that extracts the Bearer token from the `Authorization` header and calls `supabase.auth.getUser(token)` using the service role client.

**Rationale**: `getUser(token)` validates the JWT signature and expiration server-side. Using the service role key ensures the verification bypasses RLS. Returns the full user object for use in endpoint logic.

**Alternatives considered**:

- Manual JWT decode with `jsonwebtoken` — rejected; Supabase provides built-in verification
- Middleware pattern — rejected; Vercel serverless functions don't support Express-style middleware natively

### 5. Route Protection

**Decision**: Use Vue Router `beforeEach` navigation guard that checks auth state from the Pinia store. Store the intended destination in the `redirect` query parameter when redirecting to login.

**Rationale**: Navigation guards are the standard Vue Router pattern for route protection. Storing the redirect target as a query parameter (`/login?redirect=/endpoints/abc`) allows the login page to redirect back after successful authentication (per FR-013).

**Alternatives considered**:

- Per-route guards — rejected; repetitive when most routes need the same check
- Route meta + middleware — same approach but more complex naming; simple `beforeEach` suffices

### 6. Multi-Tab Logout Sync

**Decision**: Rely on Supabase's `onAuthStateChange` listener which fires across tabs when localStorage changes (via the browser's `storage` event).

**Rationale**: Supabase Auth automatically detects localStorage changes across tabs and fires `SIGNED_OUT` events. No custom cross-tab communication needed.

**Alternatives considered**:

- BroadcastChannel API — rejected; unnecessary when Supabase handles it
- Custom localStorage event listener — rejected; Supabase already does this
