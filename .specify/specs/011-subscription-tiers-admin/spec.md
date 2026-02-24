# Feature Specification: Subscription Tiers & Admin Panel

**Feature Branch**: `011-subscription-tiers-admin`
**Created**: 2026-02-23
**Status**: Draft
**Input**: Free/Pro subscription tiers with feature gating, profiles table, and admin panel for user management

## Overview

This feature introduces a two-tier subscription model (Free and Pro) to HookSpy, a user profiles system, and an admin panel. Free users get limited access suitable for trying the tool; Pro users unlock higher limits and advanced features. Admins can manage users and plans via an in-app admin panel. The schema is designed to support future Stripe payment integration, but this spec covers manual admin-controlled plan assignment only.

---

## Clarifications

### Session 2026-02-24

- Q: When an admin disables a user, what happens to already-active browser sessions? → A: Lazy invalidation — session continues until next API call, which checks `status = 'disabled'` and returns 401. The frontend handles 401 by signing out and redirecting to login with a "Your account has been disabled" message.
- Q: How should admin access to profiles and admin_audit_log be handled — service role bypass or RLS policies? → A: RLS admin policies. Add explicit RLS policies granting `role = 'admin'` SELECT/UPDATE on all profiles rows and SELECT on admin_audit_log. Admin API endpoints use the anon client with the user's JWT, not the service role key.
- Q: What rate limiting window type and cleanup frequency? → A: Fixed 1-minute tumbling window. Counter resets at the start of each calendar minute. Atomic upsert per request. pg_cron cleans stale rows hourly.
- Q: When downgrading a Pro user to Free with excess endpoints, which endpoints get deactivated? → A: Auto-deactivate the most recently created endpoints beyond the Free limit (ordered by `created_at DESC`). The user can swap later by deactivating one and activating another.
- Q: How should plan limits be shared between API (serverless) and frontend (Vite SPA)? → A: Store plan limits in a Supabase `plan_config` table, fetched at runtime by both API and frontend. This allows changing limits without redeploying.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Gets Free Plan by Default (Priority: P1)

A new user registers and is automatically assigned the Free plan. Their profile is created with default limits, and they can immediately start using HookSpy within Free tier constraints.

**Why this priority**: Every user must have a plan from signup. This is foundational.

**Independent Test**: Register a new account, then verify a profile row exists with `plan = 'free'` and `role = 'user'`.

**Acceptance Scenarios**:

1. **Given** I am a new user, **When** I complete registration, **Then** a profile is created with `plan = 'free'` and `role = 'user'`
2. **Given** I am a Free user, **When** I view the dashboard, **Then** I see a "Free Plan" badge in the header or sidebar
3. **Given** I am a Free user, **When** I view my account settings, **Then** I see my current plan and its limits
4. **Given** a profile creation fails (DB trigger error), **When** I log in, **Then** the app retries profile creation or shows a clear error

---

### User Story 2 - Free User Hits Endpoint Limit (Priority: P1)

A Free user tries to create more endpoints than their plan allows. The system blocks the action and shows an upgrade prompt.

**Why this priority**: Endpoint limits are the primary differentiation between plans.

**Independent Test**: As a Free user with 3 endpoints, attempt to create a 4th and verify it is blocked.

**Acceptance Scenarios**:

1. **Given** I am a Free user with 3 endpoints, **When** I try to create a 4th endpoint, **Then** I see a message: "Free plan allows up to 3 endpoints. Upgrade to Pro for up to 25."
2. **Given** I am a Pro user with 10 endpoints, **When** I try to create an 11th endpoint, **Then** the endpoint is created successfully (up to 25)
3. **Given** I am a Free user, **When** I view the endpoint list, **Then** I see a usage indicator like "3/3 endpoints used"
4. **Given** I am a Free user at the limit, **When** I see the upgrade prompt, **Then** the prompt includes a CTA to contact admin or learn about Pro (placeholder for future Stripe)

---

### User Story 3 - Free User Restricted from Pro-Only Features (Priority: P1)

A Free user cannot access features gated to the Pro plan: replay, full search/filter, and custom header injection.

**Why this priority**: Feature gating is the core monetization mechanism.

**Independent Test**: As a Free user, attempt to replay a log, use advanced search, and add custom headers. Verify all are blocked with upgrade prompts.

**Acceptance Scenarios**:

1. **Given** I am a Free user viewing a log, **When** I click "Replay", **Then** I see a tooltip or message: "Replay is a Pro feature" with an upgrade CTA
2. **Given** I am a Free user on the log viewer, **When** I try to use text search or date range filter, **Then** the advanced filter inputs are disabled/locked with a Pro badge
3. **Given** I am a Free user, **When** I view the status filter, **Then** status filter works (basic filtering is allowed on Free)
4. **Given** I am a Free user editing an endpoint, **When** I see the custom headers section, **Then** it is disabled with a "Pro feature" label
5. **Given** I am a Pro user, **When** I access any of the above features, **Then** they work without restriction

---

### User Story 4 - Free User Has Reduced Rate Limit and Body Size (Priority: P1)

Incoming webhooks for Free user endpoints are subject to stricter rate limits and body size caps.

**Why this priority**: Server-side enforcement prevents abuse and differentiates plans.

**Independent Test**: Send 31 requests in 1 minute to a Free user's endpoint. Verify the 31st returns 429. Send a 300KB body; verify it returns 413.

**Acceptance Scenarios**:

1. **Given** a Free user's endpoint has received 30 requests this minute, **When** a 31st request arrives, **Then** the webhook receiver returns `429 Too Many Requests` with a `Retry-After` header
2. **Given** a Pro user's endpoint, **When** 120 requests arrive in 1 minute, **Then** all are accepted
3. **Given** a Free user's endpoint, **When** a request with a 300KB body arrives, **Then** the receiver returns `413 Payload Too Large`
4. **Given** a Pro user's endpoint, **When** a request with a 3MB body arrives, **Then** it is accepted (up to 5MB)
5. **Given** a Free user's endpoint, **When** a request arrives with timeout > 30s configured, **Then** the max effective timeout is capped at 30s regardless of endpoint config

---

### User Story 5 - Free User Has Reduced Log Retention (Priority: P2)

Free users' logs are cleaned up after 6 hours instead of the Pro plan's 7 days.

**Why this priority**: Differentiated retention incentivizes upgrades but isn't blocking for core functionality.

**Independent Test**: Insert a log for a Free user with `received_at` 7 hours ago. Run the cleanup job. Verify the log is deleted. Insert a log for a Pro user with `received_at` 2 days ago. Verify it is retained.

**Acceptance Scenarios**:

1. **Given** a Free user's log is older than 6 hours, **When** the pg_cron cleanup runs, **Then** the log is deleted
2. **Given** a Pro user's log is older than 6 hours but less than 7 days, **When** the pg_cron cleanup runs, **Then** the log is retained
3. **Given** a Pro user's log is older than 7 days, **When** the pg_cron cleanup runs, **Then** the log is deleted
4. **Given** I am a Free user, **When** I view the log viewer, **Then** I see a note: "Free plan retains logs for 6 hours"

---

### User Story 6 - Admin Views User List (Priority: P1)

An admin navigates to `/admin/users` and sees a paginated, searchable list of all users with their plan, role, endpoint count, request volume, and account status.

**Why this priority**: User management is the primary admin capability.

**Independent Test**: Log in as an admin, navigate to `/admin/users`, verify the user table shows all registered users with correct metadata.

**Acceptance Scenarios**:

1. **Given** I am an admin, **When** I navigate to `/admin/users`, **Then** I see a table of all users with columns: email, plan, role, endpoints count, requests (24h), status, joined date
2. **Given** there are 50 users, **When** I view the list, **Then** results are paginated (20 per page)
3. **Given** I type in the search box, **When** I search by email, **Then** the table filters to matching users
4. **Given** I click a filter dropdown, **When** I filter by plan (Free/Pro) or status (active/disabled), **Then** the table updates accordingly
5. **Given** I am a non-admin user, **When** I navigate to `/admin/users`, **Then** I am redirected to the dashboard with no error leakage

---

### User Story 7 - Admin Changes a User's Plan (Priority: P1)

An admin upgrades or downgrades a user's plan from the admin panel.

**Why this priority**: Manual plan management is the only plan change mechanism in this phase.

**Independent Test**: As an admin, change a Free user to Pro. Verify the user's profile is updated and their limits change immediately.

**Acceptance Scenarios**:

1. **Given** I am an admin viewing a Free user, **When** I change their plan to Pro, **Then** the profile is updated and a confirmation toast appears
2. **Given** a user was just upgraded to Pro, **When** they refresh their browser, **Then** they see Pro features unlocked and new limits
3. **Given** I am an admin downgrading a Pro user to Free, **When** they have 10 endpoints, **Then** the downgrade succeeds, the 7 most recently created endpoints are auto-deactivated (`is_active = false`), and the user sees a banner explaining they can swap active endpoints
4. **Given** a plan change occurs, **When** viewing the admin panel, **Then** an audit entry is logged with admin_id, user_id, old_plan, new_plan, timestamp

---

### User Story 8 - Admin Disables/Enables a User Account (Priority: P2)

An admin can disable a user account to prevent login and webhook processing.

**Why this priority**: Account management is necessary for abuse prevention.

**Independent Test**: Disable a user account as admin. Verify the user cannot log in and their endpoints return 403.

**Acceptance Scenarios**:

1. **Given** I am an admin, **When** I click "Disable" on a user, **Then** their status changes to `disabled` and a confirmation dialog appears first
2. **Given** a user is disabled, **When** they try to log in, **Then** they see "Your account has been disabled. Contact support."
3. **Given** a user is disabled, **When** a webhook arrives at their endpoint, **Then** the receiver returns `403 Forbidden`
4. **Given** I am an admin, **When** I re-enable a disabled user, **Then** their status changes back to `active` and they can log in again
5. **Given** a user is disabled, **When** they have an active browser session and make any API call, **Then** the API returns `401` and the frontend signs them out with a "Your account has been disabled" message

---

### User Story 9 - Admin Views System-Wide Stats (Priority: P2)

The admin dashboard at `/admin` shows high-level system metrics.

**Why this priority**: Useful for monitoring but not blocking for user management.

**Independent Test**: Log in as admin, navigate to `/admin`. Verify system stats are displayed.

**Acceptance Scenarios**:

1. **Given** I am an admin, **When** I navigate to `/admin`, **Then** I see: total users, users by plan (Free/Pro breakdown), total endpoints, total requests (24h)
2. **Given** new users register, **When** I refresh the admin dashboard, **Then** the stats are updated
3. **Given** I am an admin, **When** I view the sidebar, **Then** I see an "Admin" section with links to Dashboard and Users

---

### User Story 10 - User Views Account Settings (Priority: P2)

An authenticated user can view their profile, current plan, usage stats, and plan limits on an account settings page.

**Why this priority**: Users need visibility into their plan and usage.

**Independent Test**: Navigate to `/settings` as a Free user. Verify plan info and usage are displayed.

**Acceptance Scenarios**:

1. **Given** I am a Free user, **When** I navigate to `/settings`, **Then** I see: my email, current plan (Free), plan limits, and current usage
2. **Given** I am at 2/3 endpoints, **When** I view settings, **Then** I see a usage bar or fraction for endpoints
3. **Given** I am a Free user, **When** I view settings, **Then** I see a "Learn about Pro" section (placeholder for future upgrade flow)

---

### Edge Cases

- What happens when an admin tries to change their own role? Prevent self-demotion to avoid lockout
- What happens when the only admin is disabled? Prevent disabling the last admin
- What happens when a Pro user is downgraded and has more endpoints than Free allows? The most recently created endpoints beyond the Free limit are auto-deactivated (ordered by `created_at DESC`). User sees a banner explaining they can swap by deactivating one and activating another. A Free user with deactivated excess endpoints MUST NOT be able to activate one without first deactivating another (total active ≤ plan max)
- What happens when a user's plan changes mid-webhook (during polling)? The webhook completes with the limits that were active when it started
- What happens to rate limit counters at plan change? Counters reset on plan upgrade
- What happens if the profiles trigger fails during registration? Auth succeeds but API calls fail; the app should detect missing profile and create one lazily

---

## Requirements *(mandatory)*

### Functional Requirements

#### Profiles & Plans

- **FR-001**: System MUST create a `profiles` table with: `id` (uuid PK, FK to auth.users), `email` (text), `display_name` (text nullable), `plan` (enum: 'free', 'pro', default 'free'), `role` (enum: 'user', 'admin', default 'user'), `status` (enum: 'active', 'disabled', default 'active'), `plan_changed_at` (timestamptz), `created_at`, `updated_at`
- **FR-002**: System MUST create a database trigger that auto-creates a profile row when a new user signs up via Supabase Auth (`on INSERT to auth.users`)
- **FR-003**: System MUST include a `stripe_customer_id` (text nullable) and `stripe_subscription_id` (text nullable) column in profiles for future payment integration
- **FR-004**: All new users MUST default to `plan = 'free'`, `role = 'user'`, `status = 'active'`
- **FR-005**: RLS policies for `profiles` MUST allow: (a) users can SELECT/UPDATE their own row (`id = auth.uid()`), (b) admins can SELECT/UPDATE all rows (where caller's profile has `role = 'admin'`). Users MUST NOT be able to modify `plan`, `role`, or `status` columns (enforce via API validation, not RLS column-level).
- **FR-006**: RLS policies for `admin_audit_log` MUST allow: (a) INSERT by service role only (via trigger or API), (b) SELECT by admins only (where caller's profile has `role = 'admin'`). Regular users MUST have no access.
- **FR-007**: Admin API endpoints MUST use the Supabase anon client with the user's JWT for reads and profile updates, relying on RLS admin policies for authorization. Exception: audit log inserts (`admin_audit_log`) MUST use the service role client since the table has no INSERT RLS policy for anon. The service role client is also used for webhook receiver log inserts and the profile trigger.

#### Plan Limits

- **FR-010**: System MUST store plan limits in a `plan_config` table in Supabase with columns: `plan` (text PK, e.g. 'free', 'pro'), `max_endpoints` (int), `requests_per_min` (int), `max_body_bytes` (int), `log_retention_hours` (int), `max_timeout_seconds` (int), `can_replay` (boolean), `can_search` (boolean), `can_inject_headers` (boolean), `updated_at` (timestamptz). Both API and frontend fetch limits at runtime. The frontend SHOULD cache via the `useUserPlan` composable (refreshed on login/plan change). The API helper `getPlanLimits(plan)` queries this table with short caching. A seed migration populates default values:

| Limit | Free | Pro |
|---|---|---|
| Max endpoints | 3 | 25 |
| Requests/min/endpoint | 30 | 120 |
| Max request body size | 256 KB | 5 MB |
| Log retention | 6 hours | 7 days |
| Max timeout | 30s | 55s |
| Replay | No | Yes |
| Search & advanced filters | Status only | Full (text, method, date range) |
| Custom header injection | No | Yes |

- **FR-011**: Endpoint creation MUST be rejected with `403` and a descriptive message when the user exceeds their plan's endpoint limit
- **FR-012**: Webhook receiver MUST enforce per-plan rate limits (requests/min/endpoint) and return `429` when exceeded
- **FR-013**: Webhook receiver MUST enforce per-plan body size limits and return `413` when exceeded
- **FR-014**: Webhook receiver MUST cap effective timeout to the plan's max timeout
- **FR-015**: Replay endpoint MUST return `403` for Free users
- **FR-016**: Log search endpoint MUST restrict Free users to `status` filter only; `q`, `method`, `from`, `to` params MUST be ignored for Free users
- **FR-017**: Endpoint create/update MUST strip `custom_headers` for Free users (silently ignore, do not error)
- **FR-017a**: When a user's plan is downgraded, the system MUST auto-deactivate endpoints exceeding the new plan's limit, ordered by `created_at DESC` (most recent deactivated first). Endpoints are NOT deleted.
- **FR-017b**: A user MUST NOT be able to activate an endpoint if their active endpoint count already equals their plan's max. The toggle MUST show a message: "Deactivate another endpoint first to activate this one."
- **FR-018**: Log cleanup job MUST delete logs older than 6 hours for Free users and older than 7 days for Pro users

#### Plan Enforcement Middleware

- **FR-020**: System MUST provide an `api/_lib/plans.js` module that exports:
  - `getPlanLimits(plan)` — queries `plan_config` table (with short TTL cache) and returns the limits object
  - `getUserPlan(userId)` — queries the profile and returns plan + status
  - `checkEndpointLimit(userId)` — returns `{ allowed: boolean, current: number, max: number }`
  - `checkRateLimit(endpointSlug, plan)` — returns `{ allowed: boolean, remaining: number, resetAt: Date }`
- **FR-021**: Rate limiting MUST use a Supabase table `rate_limits` with columns: `key` (text PK, format: `slug:YYYYMMDD-HHmm`), `count` (int), `window_start` (timestamptz). Uses a fixed 1-minute tumbling window: the counter resets at the start of each calendar minute. Each incoming request performs an atomic upsert (INSERT ... ON CONFLICT UPDATE `count = count + 1`). A pg_cron job cleans rows with `window_start` older than 5 minutes, running hourly.

#### Admin Panel

- **FR-030**: System MUST provide admin routes under `/admin/*` in the existing Vue SPA, guarded by `role = 'admin'` check
- **FR-031**: Admin dashboard (`/admin`) MUST display: total users, Free/Pro breakdown, total endpoints, total requests (24h)
- **FR-032**: Admin user list (`/admin/users`) MUST display a paginated table (20/page) with columns: email, plan, role, endpoints count, requests (24h), status, joined date
- **FR-033**: Admin user list MUST support search by email and filter by plan and status
- **FR-034**: Admin MUST be able to change a user's plan (Free <-> Pro) from the user list or a user detail view
- **FR-035**: Admin MUST be able to disable/enable a user account
- **FR-036**: System MUST prevent an admin from demoting themselves or disabling the last admin
- **FR-037**: All admin plan changes MUST be logged in an `admin_audit_log` table with: `id`, `admin_id`, `target_user_id`, `action` (text), `old_value` (jsonb), `new_value` (jsonb), `created_at`
- **FR-038**: Admin API endpoints MUST verify the caller has `role = 'admin'` via a shared `requireAdmin(req)` middleware
- **FR-038a**: All authenticated API endpoints MUST check `profiles.status` and return `401` with `{ error: 'account_disabled' }` if the user is disabled (lazy session invalidation). This check SHOULD be part of the existing `verifyAuth` helper or a wrapper around it.
- **FR-039**: Non-admin users navigating to `/admin/*` MUST be silently redirected to the dashboard

#### Admin Seeding

- **FR-040**: A database migration MUST seed the first admin by matching a configurable email address (set via `ADMIN_EMAIL` in the migration or as a migration variable)
- **FR-041**: If the admin email user already exists, the migration MUST update their profile to `role = 'admin'`. If they haven't registered yet, a comment in the migration MUST explain that the auth trigger will create the profile and a follow-up migration or manual step is needed to set the role

#### Frontend Feature Gating

- **FR-050**: System MUST provide a `useUserPlan` composable that exposes: `plan`, `limits`, `canReplay`, `canSearch`, `canInjectHeaders`, `endpointsRemaining`, `isAdmin`
- **FR-051**: Gated UI elements MUST show a lock icon or "Pro" badge and display a tooltip/popover explaining the restriction
- **FR-052**: The app header or sidebar MUST display the current plan badge (Free/Pro)
- **FR-053**: A new `/settings` route MUST show: user email, current plan, usage vs limits, and a "Learn about Pro" placeholder section

#### User Account Settings Page

- **FR-060**: The settings page MUST display: email (read-only), display name (editable), current plan with badge, usage stats (endpoints used/max), and plan feature comparison table
- **FR-061**: The settings page MUST include a "Learn about Pro" card for Free users that explains Pro benefits (placeholder for future Stripe upgrade button)

### Non-Functional Requirements

- **NFR-001**: Plan checks MUST add less than 50ms latency to API requests (single DB query, cacheable)
- **NFR-002**: Rate limit checks MUST use upsert operations to avoid race conditions
- **NFR-003**: Admin user list MUST load within 2 seconds for up to 1000 users
- **NFR-004**: Plan limit configuration MUST be stored in the `plan_config` Supabase table as the single source of truth. Both API and frontend fetch at runtime. API caching SHOULD use a short TTL (≤60s in-memory per serverless invocation). Frontend caching via `useUserPlan` composable, refreshed on login and plan change events.
- **NFR-005**: All admin actions MUST be audit-logged with no exceptions

### Key Entities

- **profiles**: User profile with plan, role, status, and Stripe placeholders
- **rate_limits**: Sliding window rate limit counters per endpoint
- **admin_audit_log**: Immutable log of admin actions
- **plan_config**: Plan limit definitions stored in Supabase (readable by all authenticated users, writable by admins only)

### API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/stats` | System-wide statistics | Admin |
| GET | `/api/admin/users` | Paginated user list with filters | Admin |
| GET | `/api/admin/users/:id` | Single user detail | Admin |
| PUT | `/api/admin/users/:id/plan` | Change user plan | Admin |
| PUT | `/api/admin/users/:id/status` | Enable/disable user | Admin |
| GET | `/api/admin/audit-log` | Audit log entries | Admin |
| GET | `/api/profile` | Current user's profile | User |
| PUT | `/api/profile` | Update display name | User |

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New users are assigned Free plan within 1 second of registration (DB trigger latency)
- **SC-002**: Free users are blocked from creating a 4th endpoint with a clear upgrade message
- **SC-003**: Pro-only features (replay, search, custom headers) are inaccessible to Free users in both UI and API
- **SC-004**: Rate limits are enforced correctly — 31st request in a minute returns 429 for Free users
- **SC-005**: Admin can view, search, and filter users and change plans within the admin panel
- **SC-006**: Plan changes take effect immediately (no cache staleness beyond 1 minute)
- **SC-007**: All admin actions are recorded in the audit log
- **SC-008**: Non-admin users cannot access admin routes or API endpoints
- **SC-009**: Log retention respects plan-based durations (6h Free, 7d Pro)
- **SC-010**: Admin panel loads within 2 seconds and handles 1000+ users without performance issues

---

## Dependencies

- **002-database-schema**: Profiles table extends the existing schema; cleanup job must be updated for plan-aware retention
- **003-authentication**: Auth trigger must be extended to create profile rows; auth store must expose plan/role
- **004-endpoint-management**: Endpoint creation must check plan limits
- **005-webhook-receiver**: Must enforce per-plan rate limits, body size, and timeout caps
- **006-browser-relay**: No changes needed (relay is plan-agnostic)
- **007-log-viewer**: Must gate advanced search/filter for Free users
- **008-replay-search**: Replay must be gated for Free users
- **009-dashboard**: Must show plan badge and usage indicators

---

## Future Considerations (Out of Scope)

- **Stripe integration**: Self-service upgrade/downgrade via Stripe Checkout and billing portal. Schema is prepared (`stripe_customer_id`, `stripe_subscription_id`) but not wired.
- **Usage-based billing**: Charging per request beyond a threshold rather than flat tiers.
- **Team/organization plans**: Multiple users sharing endpoints under one billing entity.
- **Granular permissions**: Beyond admin/user roles (e.g., read-only, billing-only).
- **Email notifications**: Notify users when approaching limits or when plan changes.
