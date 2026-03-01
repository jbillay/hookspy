# API Contracts: Subscription Tiers & Admin Panel

**Feature**: 011-subscription-tiers-admin
**Date**: 2026-02-24

All endpoints require `Authorization: Bearer <jwt>` unless noted otherwise. All responses are `application/json`.

---

## Profile Endpoints

### GET /api/profile

Returns the current user's profile with plan limits.

**Response 200**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "John",
  "plan": "free",
  "role": "user",
  "status": "active",
  "plan_changed_at": "2026-02-24T10:00:00Z",
  "created_at": "2026-02-20T08:00:00Z",
  "limits": {
    "max_endpoints": 3,
    "requests_per_min": 30,
    "max_body_bytes": 262144,
    "log_retention_hours": 6,
    "max_timeout_seconds": 30,
    "can_replay": false,
    "can_search": false,
    "can_inject_headers": false
  },
  "usage": {
    "endpoints_count": 2,
    "endpoints_active": 1
  }
}
```

**Response 401**: `{ "error": "Unauthorized" }` or `{ "error": "account_disabled" }`

---

### PUT /api/profile

Updates the current user's display name.

**Request body**:

```json
{
  "display_name": "New Name"
}
```

**Validation**:

- `display_name`: string, max 100 chars, nullable (to clear)
- Cannot modify: `plan`, `role`, `status`, `email`

**Response 200**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "New Name",
  "plan": "free",
  "role": "user",
  "status": "active",
  "updated_at": "2026-02-24T12:00:00Z"
}
```

**Response 400**: `{ "error": "display_name must be 100 characters or less" }`

---

## Admin Endpoints

All admin endpoints require `role = 'admin'` in the caller's profile. Returns 403 if not admin.

### GET /api/admin/stats

**Response 200**:

```json
{
  "total_users": 150,
  "users_by_plan": {
    "free": 120,
    "pro": 30
  },
  "users_by_status": {
    "active": 145,
    "disabled": 5
  },
  "total_endpoints": 320,
  "total_requests_24h": 5420
}
```

---

### GET /api/admin/users

**Query parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number (1-indexed) |
| `limit` | int | 20 | Items per page (max 100) |
| `search` | string | — | Search by email (ILIKE) |
| `plan` | string | — | Filter by plan: `free`, `pro` |
| `status` | string | — | Filter by status: `active`, `disabled` |
| `sort` | string | `created_at` | Sort field: `created_at`, `email`, `plan` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Response 200**:

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "John",
      "plan": "free",
      "role": "user",
      "status": "active",
      "endpoints_count": 3,
      "requests_24h": 42,
      "created_at": "2026-02-20T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

### GET /api/admin/users/:id

**Response 200**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "John",
  "plan": "free",
  "role": "user",
  "status": "active",
  "plan_changed_at": "2026-02-24T10:00:00Z",
  "created_at": "2026-02-20T08:00:00Z",
  "endpoints_count": 3,
  "endpoints_active": 2,
  "requests_24h": 42
}
```

**Response 404**: `{ "error": "User not found" }`

---

### PUT /api/admin/users/:id/plan

**Request body**:

```json
{
  "plan": "pro"
}
```

**Validation**:

- `plan`: must be `"free"` or `"pro"`
- Cannot change own plan (admin self-modification guard)

**Behavior**:

- Updates `profiles.plan` and `profiles.plan_changed_at`
- If downgrade and active endpoints > new plan max: auto-deactivates most recent endpoints
- Logs to `admin_audit_log`

**Response 200**:

```json
{
  "id": "uuid",
  "plan": "pro",
  "plan_changed_at": "2026-02-24T12:00:00Z",
  "endpoints_deactivated": 0
}
```

**Response 400**: `{ "error": "Invalid plan value" }`
**Response 403**: `{ "error": "Cannot change your own plan" }`

---

### PUT /api/admin/users/:id/status

**Request body**:

```json
{
  "status": "disabled"
}
```

**Validation**:

- `status`: must be `"active"` or `"disabled"`
- Cannot disable self
- Cannot disable the last admin

**Response 200**:

```json
{
  "id": "uuid",
  "status": "disabled",
  "updated_at": "2026-02-24T12:00:00Z"
}
```

**Response 400**: `{ "error": "Cannot disable the last admin" }`
**Response 403**: `{ "error": "Cannot change your own status" }`

---

### GET /api/admin/audit-log

**Query parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 50 | Items per page (max 100) |
| `target_user_id` | uuid | — | Filter by affected user |
| `action` | string | — | Filter by action type |

**Response 200**:

```json
{
  "entries": [
    {
      "id": "uuid",
      "admin_email": "admin@example.com",
      "target_email": "user@example.com",
      "action": "plan_change",
      "old_value": { "plan": "free" },
      "new_value": { "plan": "pro" },
      "created_at": "2026-02-24T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "total_pages": 1
  }
}
```

---

## Modified Existing Endpoints

### POST /api/endpoints (create)

**New behavior**: Before creating, checks `checkEndpointLimit(userId)`.

**New error response 403**:

```json
{
  "error": "Endpoint limit reached",
  "message": "Free plan allows up to 3 endpoints. Upgrade to Pro for up to 25.",
  "current": 3,
  "max": 3
}
```

### PUT /api/endpoints/:id (update/toggle)

**New behavior on activate**: Checks active endpoint count ≤ plan max before setting `is_active = true`.

**New error response 403**:

```json
{
  "error": "Active endpoint limit reached",
  "message": "Deactivate another endpoint first to activate this one.",
  "active": 3,
  "max": 3
}
```

**New behavior on custom headers**: If Free user, `custom_headers` field is silently stripped from the update payload.

### POST /api/logs/:id/replay

**New behavior**: Checks `can_replay` from plan config. If false, returns 403.

**New error response 403**:

```json
{
  "error": "Pro feature",
  "message": "Replay is available on the Pro plan."
}
```

### GET /api/logs (list with filters)

**New behavior**: If Free user, ignores `q`, `method`, `from`, `to` params. Only `endpoint_id`, `status`, `page`, `limit` are processed.

### GET /api/hook/:slug (webhook receiver)

**New behavior**:

1. After looking up endpoint, fetch owner's plan via profile join
2. Check rate limit against plan's `requests_per_min` (database-backed, replaces in-memory)
3. Check body size against plan's `max_body_bytes`
4. Cap timeout to plan's `max_timeout_seconds`
5. If owner is disabled (`status = 'disabled'`), return 403

**New error responses**:

- 429: `Too Many Requests` (with `Retry-After` header, seconds until next minute)
- 413: `Payload Too Large` (with `max_size` in response)
- 403: `Endpoint owner account disabled`
