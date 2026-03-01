# Data Model: Subscription Tiers & Admin Panel

**Feature**: 011-subscription-tiers-admin
**Date**: 2026-02-24

## New Tables

### profiles

User profile extending Supabase Auth. Created automatically via trigger on `auth.users` INSERT.

| Column                   | Type        | Constraints                                        | Default    | Description                        |
| ------------------------ | ----------- | -------------------------------------------------- | ---------- | ---------------------------------- |
| `id`                     | uuid        | PK, FK → auth.users(id) ON DELETE CASCADE          | —          | Matches auth user ID               |
| `email`                  | text        | NOT NULL                                           | —          | Copied from auth.users on creation |
| `display_name`           | text        | —                                                  | NULL       | Optional display name              |
| `plan`                   | text        | NOT NULL, CHECK (plan IN ('free', 'pro'))          | `'free'`   | Subscription tier                  |
| `role`                   | text        | NOT NULL, CHECK (role IN ('user', 'admin'))        | `'user'`   | Authorization role                 |
| `status`                 | text        | NOT NULL, CHECK (status IN ('active', 'disabled')) | `'active'` | Account status                     |
| `plan_changed_at`        | timestamptz | —                                                  | NULL       | Last plan change timestamp         |
| `stripe_customer_id`     | text        | —                                                  | NULL       | Future Stripe integration          |
| `stripe_subscription_id` | text        | —                                                  | NULL       | Future Stripe integration          |
| `created_at`             | timestamptz | NOT NULL                                           | `now()`    | Profile creation time              |
| `updated_at`             | timestamptz | NOT NULL                                           | `now()`    | Last update (trigger-managed)      |

**Indexes**:

- PK on `id`
- Index on `plan` (for admin filtering)
- Index on `status` (for admin filtering)
- Index on `email` (for admin search)

**RLS Policies**:

- `profiles_select_own`: Users can SELECT their own row (`id = auth.uid()`)
- `profiles_update_own`: Users can UPDATE their own row (`id = auth.uid()`) — API validates no plan/role/status changes
- `admins_select_all`: Admins can SELECT all rows (`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`)
- `admins_update_all`: Admins can UPDATE all rows (same admin check)

**Trigger**:

- `handle_new_user()`: AFTER INSERT on `auth.users` → INSERT into profiles with `id`, `email`
- `update_updated_at()`: BEFORE UPDATE on profiles → SET `updated_at = now()`

**State Transitions**:

```
plan:   free ←→ pro       (admin action only)
status: active ←→ disabled (admin action only)
role:   user → admin       (migration/admin only; self-demotion blocked)
```

---

### plan_config

Runtime-configurable plan limits. Queried by both API and frontend.

| Column                | Type        | Constraints | Default | Description                                |
| --------------------- | ----------- | ----------- | ------- | ------------------------------------------ |
| `plan`                | text        | PK          | —       | Plan identifier ('free', 'pro')            |
| `max_endpoints`       | int         | NOT NULL    | —       | Max endpoints per user                     |
| `requests_per_min`    | int         | NOT NULL    | —       | Rate limit per endpoint per minute         |
| `max_body_bytes`      | int         | NOT NULL    | —       | Max webhook request body size              |
| `log_retention_hours` | int         | NOT NULL    | —       | Hours to retain logs                       |
| `max_timeout_seconds` | int         | NOT NULL    | —       | Max webhook timeout                        |
| `can_replay`          | boolean     | NOT NULL    | —       | Whether replay is allowed                  |
| `can_search`          | boolean     | NOT NULL    | —       | Whether advanced search is allowed         |
| `can_inject_headers`  | boolean     | NOT NULL    | —       | Whether custom header injection is allowed |
| `updated_at`          | timestamptz | NOT NULL    | `now()` | Last update                                |

**Seed Data**:

| plan | max_endpoints | requests_per_min | max_body_bytes | log_retention_hours | max_timeout_seconds | can_replay | can_search | can_inject_headers |
| ---- | ------------- | ---------------- | -------------- | ------------------- | ------------------- | ---------- | ---------- | ------------------ |
| free | 3             | 30               | 262144         | 6                   | 30                  | false      | false      | false              |
| pro  | 25            | 120              | 5242880        | 168                 | 55                  | true       | true       | true               |

**RLS Policies**:

- `plan_config_select_authenticated`: All authenticated users can SELECT (`auth.uid() IS NOT NULL`)
- `plan_config_update_admins`: Only admins can UPDATE

---

### rate_limits

Fixed 1-minute tumbling window rate limit counters.

| Column         | Type        | Constraints | Default | Description                      |
| -------------- | ----------- | ----------- | ------- | -------------------------------- |
| `key`          | text        | PK          | —       | Format: `{slug}:{YYYYMMDD-HHmm}` |
| `count`        | int         | NOT NULL    | `1`     | Request count in current window  |
| `window_start` | timestamptz | NOT NULL    | —       | Start of the 1-minute window     |

**RLS**: Disabled (accessed only via service role in webhook receiver)

**Cleanup**: pg_cron job runs hourly, deletes rows where `window_start < now() - interval '5 minutes'`

**Atomic upsert pattern**:

```sql
INSERT INTO rate_limits (key, count, window_start)
VALUES ($1, 1, date_trunc('minute', now()))
ON CONFLICT (key)
DO UPDATE SET
  count = CASE
    WHEN rate_limits.window_start = date_trunc('minute', now()) THEN rate_limits.count + 1
    ELSE 1
  END,
  window_start = date_trunc('minute', now())
RETURNING count;
```

---

### admin_audit_log

Immutable log of admin actions. Append-only.

| Column           | Type        | Constraints                   | Default             | Description                                        |
| ---------------- | ----------- | ----------------------------- | ------------------- | -------------------------------------------------- |
| `id`             | uuid        | PK                            | `gen_random_uuid()` | Unique entry ID                                    |
| `admin_id`       | uuid        | NOT NULL, FK → auth.users(id) | —                   | Admin who performed the action                     |
| `target_user_id` | uuid        | NOT NULL, FK → auth.users(id) | —                   | User affected                                      |
| `action`         | text        | NOT NULL                      | —                   | Action type (e.g., 'plan_change', 'status_change') |
| `old_value`      | jsonb       | —                             | NULL                | Previous state                                     |
| `new_value`      | jsonb       | —                             | NULL                | New state                                          |
| `created_at`     | timestamptz | NOT NULL                      | `now()`             | When the action occurred                           |

**Indexes**:

- PK on `id`
- Index on `admin_id`
- Index on `target_user_id`
- Index on `created_at DESC`

**RLS Policies**:

- `audit_log_select_admins`: Only admins can SELECT
- No INSERT/UPDATE/DELETE for anon client — inserts happen via service role in admin API handlers

---

## Modified Tables

### endpoints (existing)

No schema changes. Behavior changes:

- **POST /api/endpoints**: Now checks `checkEndpointLimit(userId)` before creating
- **PUT /api/endpoints/:id** (toggle active): Now checks active count ≤ plan max before activating
- **Custom headers**: Stripped for Free users on create/update

### webhook_logs (existing)

No schema changes. Behavior changes:

- **Log cleanup**: Updated from flat 24h to plan-aware retention (6h Free, 7d Pro)
- **Search**: Advanced filters restricted for Free users

---

## Entity Relationship Diagram

```
auth.users (Supabase-managed)
    │
    ├──── 1:1 ──── profiles (plan, role, status)
    │                   │
    │                   ├── plan → plan_config (FK-like, not enforced)
    │                   │
    │                   └── admin_id ──── admin_audit_log
    │                       target_user_id ─┘
    │
    ├──── 1:N ──── endpoints
    │                   │
    │                   └── slug → rate_limits (key prefix, not FK)
    │
    └──── (via endpoints) ──── webhook_logs
```
