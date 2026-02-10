# Data Model: Endpoint Management

**Feature**: 004-endpoint-management
**Date**: 2026-02-09

## Entities

### Endpoint

Already exists in database via migration `20260209000001_create_tables.sql`.

| Column | Type | Default | Constraints | Notes |
|--------|------|---------|-------------|-------|
| id | uuid | `gen_random_uuid()` | PRIMARY KEY | Auto-generated |
| user_id | uuid | — | NOT NULL, FK → auth.users(id) | Owner isolation |
| name | text | — | — | Display name |
| slug | text | — | UNIQUE, NOT NULL | 8-char hex for webhook URL |
| target_url | text | `'http://localhost'` | — | Forwarding destination host |
| target_port | integer | `3000` | — | Forwarding destination port |
| target_path | text | `'/'` | — | Forwarding destination path |
| timeout_seconds | integer | `30` | CHECK (1–55) | Max wait for relay response |
| custom_headers | jsonb | `'{}'` | — | Key-value pairs added to forwarded requests |
| is_active | boolean | `true` | — | Inactive endpoints return 404 |
| created_at | timestamptz | `now()` | — | — |
| updated_at | timestamptz | `now()` | — | Auto-updated via trigger |

**Indexes**:
- `idx_endpoints_slug` on `slug` (unique lookup for webhook routing)
- `idx_endpoints_user_id` on `user_id` (user-scoped queries)

**RLS Policies** (already applied):
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

### Relationships

- `endpoints.user_id` → `auth.users.id` (many-to-one)
- `webhook_logs.endpoint_id` → `endpoints.id` ON DELETE CASCADE (one-to-many)

### State Transitions

```
Endpoint lifecycle:
  Created (is_active=true) → Toggled inactive (is_active=false) → Toggled active (is_active=true) → Deleted

No state machine complexity — is_active is a simple boolean toggle.
```

### custom_headers Format

```json
{
  "X-Api-Key": "secret123",
  "X-Custom-Id": "my-project"
}
```

- Flat key-value object
- Keys are HTTP header names (case-preserved)
- Values are strings
- Empty object `{}` means no custom headers
- At relay time, custom headers are merged with incoming request headers (additive only, per Constitution III)

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| name | Required, non-empty | "Name is required" |
| target_port | Integer, 1–65535 | "Port must be between 1 and 65535" |
| timeout_seconds | Integer, 1–55 | "Timeout must be between 1 and 55 seconds" |
| custom_headers keys | Non-empty string when present | "Header name cannot be empty" |
| custom_headers values | Any string (can be empty) | — |

Validation is applied both client-side (form) and server-side (API handler).
