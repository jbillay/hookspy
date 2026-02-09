# Data Model: Authentication

**Feature**: 003-authentication
**Date**: 2026-02-09

## Entities

### User (managed by Supabase Auth)

The User entity is managed entirely by Supabase Auth (`auth.users` table). HookSpy does not create or manage this table directly.

| Field         | Type      | Description                          |
| ------------- | --------- | ------------------------------------ |
| id            | uuid      | Unique user identifier (primary key) |
| email         | string    | User's email address (unique)        |
| created_at    | timestamp | Account creation timestamp           |
| user_metadata | jsonb     | Custom metadata set during signup    |

**Notes**:

- User records are created via `supabase.auth.signUp()`
- The `id` field is referenced as `user_id` in the `endpoints` table (FK)
- RLS policies on `endpoints` and `webhook_logs` use `auth.uid()` which maps to this `id`

### Session (managed by Supabase Auth client)

The Session entity is managed by the Supabase JS client in browser localStorage. It is not a database table.

| Field         | Type   | Description                                 |
| ------------- | ------ | ------------------------------------------- |
| access_token  | string | JWT used for API authorization              |
| refresh_token | string | Token used to refresh expired access tokens |
| expires_at    | number | Unix timestamp when access token expires    |
| expires_in    | number | Lifetime of access token in seconds         |
| user          | object | Embedded user object                        |

**Lifecycle**:

- Created on `signUp()` or `signInWithPassword()`
- Persisted to localStorage automatically
- Refreshed automatically before expiration (`TOKEN_REFRESHED` event)
- Destroyed on `signOut()` (removed from localStorage)

## State Transitions

### Auth State Machine

```
[No Session] --signUp()--> [Authenticated]
[No Session] --signIn()--> [Authenticated]
[Authenticated] --signOut()--> [No Session]
[Authenticated] --token expires + refresh fails--> [No Session]
[Authenticated] --token expires + refresh succeeds--> [Authenticated] (TOKEN_REFRESHED)
```

### Frontend Auth State (Pinia Store)

| State           | user   | session | loading | Description                           |
| --------------- | ------ | ------- | ------- | ------------------------------------- |
| Initializing    | null   | null    | true    | App startup, checking localStorage    |
| Unauthenticated | null   | null    | false   | No session found or signed out        |
| Authenticated   | User   | Session | false   | Valid session active                  |
| Transitioning   | varies | varies  | true    | During signIn/signUp/signOut API call |

## Relationships

```
auth.users (Supabase Auth)
  └── 1:N → endpoints (via user_id FK)
               └── 1:N → webhook_logs (via endpoint_id FK, CASCADE delete)
```

Authentication provides the `user_id` that links all downstream data. RLS policies enforce that users can only access their own endpoints and logs.
