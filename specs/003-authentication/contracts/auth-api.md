# API Contract: Authentication

**Feature**: 003-authentication
**Date**: 2026-02-09

## Overview

Authentication uses Supabase Auth client-side methods (no custom API endpoints for auth flows). The server-side auth helper validates JWTs on protected API endpoints.

## Client-Side Auth Operations

These are NOT custom API endpoints — they use the Supabase JS client directly.

### Register

```
supabase.auth.signUp({ email, password })
```

**Input**: `{ email: string, password: string }`
**Success**: `{ data: { user: User, session: Session }, error: null }`
**Error**: `{ data: { user: null, session: null }, error: { message: string } }`

Error messages:

- `"User already registered"` — email already exists

### Login

```
supabase.auth.signInWithPassword({ email, password })
```

**Input**: `{ email: string, password: string }`
**Success**: `{ data: { user: User, session: Session }, error: null }`
**Error**: `{ data: { user: null, session: null }, error: { message: string } }`

Error messages:

- `"Invalid login credentials"` — wrong email or password

### Logout

```
supabase.auth.signOut()
```

**Input**: none
**Success**: `{ error: null }`
**Error**: `{ error: { message: string } }`

### Get Session

```
supabase.auth.getSession()
```

**Output**: `{ data: { session: Session | null }, error: null }`

## Server-Side Auth Verification

### Auth Helper: `api/_lib/auth.js`

**Function**: `verifyAuth(req)` → `{ user: User | null, error: string | null }`

**Input**: Vercel request object with `Authorization: Bearer <token>` header

**Success response**: `{ user: { id, email, ... }, error: null }`

**Error responses**:

- Missing header: `{ user: null, error: "Missing or invalid Authorization header" }`
- Invalid token: `{ user: null, error: "Invalid or expired token" }`

### Protected Endpoint Pattern

All protected API endpoints MUST:

1. Call `verifyAuth(req)` as the first operation
2. Return `401` with `{ error: "..." }` if auth fails
3. Use `user.id` for data scoping (e.g., filtering endpoints by user)

```
Request:
  Authorization: Bearer <jwt-access-token>
  Content-Type: application/json

401 Response (auth failed):
  { "error": "Missing or invalid Authorization header" }
  or
  { "error": "Invalid or expired token" }
```

## Frontend Authorization Header Pattern

All API calls from the frontend to `/api/*` endpoints MUST include:

```
Authorization: Bearer <session.access_token>
```

The access token is obtained from the Pinia auth store's session object.
