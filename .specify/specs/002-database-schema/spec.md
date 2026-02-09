# Feature Specification: Database Schema & Supabase Setup

**Feature Branch**: `002-database-schema`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Database design requirements for webhook relay service

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Database Tables Exist and Enforce Constraints (Priority: P1)

A developer runs the migration scripts against a fresh database project and all
tables, indexes, constraints, and triggers are created correctly. The schema
enforces data integrity so that invalid data cannot be persisted.

**Why this priority**: Every feature depends on the database schema existing. Without tables and constraints, no other feature can store or retrieve data.

**Independent Test**: Run migrations against a clean database and verify all tables exist with correct columns, types, and constraints using queries.

**Acceptance Scenarios**:

1. **Given** a fresh database project, **When** I run the migration files in order, **Then** the `endpoints` and `webhook_logs` tables are created with all defined columns
2. **Given** the tables exist, **When** I insert an endpoint without a `user_id`, **Then** the insert fails with a NOT NULL constraint violation
3. **Given** the tables exist, **When** I insert two endpoints with the same `slug`, **Then** the second insert fails with a UNIQUE constraint violation
4. **Given** a webhook_log record, **When** I delete its parent endpoint, **Then** the log record is also deleted (CASCADE)
5. **Given** the tables exist, **When** I insert a webhook_log with a status not in the allowed set, **Then** the insert fails with a CHECK constraint violation
6. **Given** the tables exist, **When** I insert an endpoint with `timeout_seconds` of 0 or 56, **Then** the insert fails with a CHECK constraint violation

---

### User Story 2 - Row Level Security Isolates Users (Priority: P1)

An authenticated user querying the database can only see and modify their own
endpoints and logs. They cannot access any other user's data. This ensures
complete data isolation between users.

**Why this priority**: Security and user isolation are foundational requirements. Without this, any user could read or modify another user's webhook configurations and intercepted data.

**Independent Test**: Create two test users, create endpoints for each, and verify each user can only read their own endpoints and associated logs.

**Acceptance Scenarios**:

1. **Given** User A has 3 endpoints and User B has 2 endpoints, **When** User A queries endpoints, **Then** User A sees only their 3 endpoints
2. **Given** User A owns Endpoint X, **When** User B tries to update Endpoint X, **Then** the update is rejected
3. **Given** User A owns Endpoint X with logs, **When** User B queries webhook_logs, **Then** User B sees zero logs for Endpoint X
4. **Given** the service role (admin-level access), **When** the serverless function inserts a log, **Then** the insert succeeds regardless of row-level security

---

### User Story 3 - Realtime Notifications Work (Priority: P1)

When a new webhook log record is inserted or updated, the system sends a
real-time notification to subscribed browser clients filtered by endpoint.
This enables the browser relay to immediately forward incoming webhooks.

**Why this priority**: The browser relay depends on instant notification of new webhooks. Without real-time events, the core relay functionality cannot work.

**Independent Test**: Subscribe to webhook log changes for a specific endpoint, insert a record, and verify the subscription receives the event within 1 second.

**Acceptance Scenarios**:

1. **Given** a real-time subscription on webhook logs filtered by `endpoint_id`, **When** a new log is inserted for that endpoint, **Then** the subscription receives the INSERT event within 1 second
2. **Given** a real-time subscription on webhook logs, **When** a log's status is updated from `pending` to `responded`, **Then** the subscription receives the UPDATE event

---

### User Story 4 - Automatic Log Cleanup (Priority: P2)

Webhook logs older than 24 hours are automatically deleted by a scheduled
database job, keeping the database clean without manual intervention. This
controls storage costs and maintains query performance.

**Why this priority**: Important for cost and performance but not blocking for core relay functionality.

**Independent Test**: Insert logs with timestamps older than 24 hours, trigger the cleanup function, and verify they are deleted while recent logs remain.

**Acceptance Scenarios**:

1. **Given** webhook logs with `received_at` older than 24 hours, **When** the cleanup job runs, **Then** those records are deleted
2. **Given** webhook logs with `received_at` within the last 24 hours, **When** the cleanup job runs, **Then** those records are NOT deleted

---

### Edge Cases

- What happens when the slug generation produces a collision? The system must guarantee uniqueness or retry on conflict
- What happens when a very large payload is stored? Text fields have no practical size limit, but query performance may degrade for payloads over 1MB
- What happens when real-time publication is not enabled on the logs table? The migration must explicitly enable real-time publication on `webhook_logs`
- What happens when the cleanup job runs while new logs are being inserted? The cleanup must only target logs with timestamps older than 24 hours at the time of execution

## Clarifications

### Session 2026-02-09

- Q: Should authenticated users be able to manually delete individual webhook logs? → A: No. Users CANNOT delete logs; only the automated 24-hour cleanup job removes them.
- Q: Should there be a maximum number of endpoints per user? → A: Yes, maximum 10 endpoints per user. Enforced at the application layer, not the database schema.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create an `endpoints` table with columns: `id` (uuid PK), `user_id` (uuid FK to auth.users, NOT NULL), `name` (text), `slug` (text, UNIQUE, NOT NULL), `target_url` (text, DEFAULT 'http://localhost'), `target_port` (integer, DEFAULT 3000), `target_path` (text, DEFAULT '/'), `timeout_seconds` (integer, DEFAULT 30, CHECK between 1 and 55), `custom_headers` (jsonb, DEFAULT '{}'), `is_active` (boolean, DEFAULT true), `created_at` (timestamptz, DEFAULT now()), `updated_at` (timestamptz, DEFAULT now())
- **FR-002**: System MUST create a `webhook_logs` table with columns: `id` (uuid PK), `endpoint_id` (uuid FK to endpoints ON DELETE CASCADE, NOT NULL), `status` (text, NOT NULL, CHECK in 'pending','forwarding','responded','timeout','error'), `request_method` (text, NOT NULL), `request_url` (text), `request_headers` (jsonb), `request_body` (text), `response_status` (integer), `response_headers` (jsonb), `response_body` (text), `error_message` (text), `received_at` (timestamptz, DEFAULT now()), `responded_at` (timestamptz), `duration_ms` (integer)
- **FR-003**: System MUST create an index on `webhook_logs(endpoint_id, received_at DESC)` for efficient log listing
- **FR-004**: System MUST create an index on `endpoints(slug)` for fast webhook URL lookup
- **FR-005**: System MUST create an index on `endpoints(user_id)` for fast user endpoint listing
- **FR-006**: System MUST create a trigger on `endpoints` to automatically update the `updated_at` column on row modification
- **FR-007**: System MUST enable row-level security on both tables with policies: endpoints SELECT/INSERT/UPDATE/DELETE restricted to `auth.uid() = user_id`; webhook_logs SELECT/UPDATE restricted to rows where the parent endpoint's `user_id = auth.uid()`. No DELETE policy for webhook_logs — log deletion is handled exclusively by the automated cleanup job (FR-009)
- **FR-008**: System MUST enable real-time publication on the `webhook_logs` table for INSERT and UPDATE events
- **FR-009**: System MUST create a scheduled job that deletes webhook_logs where `received_at < now() - interval '24 hours'`, running every hour
- **FR-010**: System MUST create all schema objects via numbered SQL migration files in `supabase/migrations/`
- **FR-011**: System MUST enforce a maximum of 10 endpoints per user. This limit is enforced at the application layer (API), not via database constraints

### Assumptions

- The database platform is Supabase (PostgreSQL with built-in auth, real-time, and row-level security)
- Authentication is handled by Supabase Auth, providing `auth.uid()` for RLS policies
- The scheduled cleanup job uses `pg_cron` or equivalent Supabase-supported scheduling mechanism
- Migration files follow Supabase CLI conventions for naming and execution order
- The `slug` field is generated by the application layer, not by the database

### Key Entities

- **endpoints**: Represents a user's webhook receiving URL with forwarding configuration. Each endpoint belongs to a single user and has a unique slug for URL routing, target forwarding settings (URL, port, path), timeout configuration, optional custom headers, and an active/inactive status.
- **webhook_logs**: Represents a single webhook request/response lifecycle. Each log belongs to an endpoint and tracks the full journey from `pending` (received) through `forwarding` (sent to browser) to a terminal state (`responded`, `timeout`, or `error`). Stores the complete request and response data including method, headers, body, status, and timing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All migration files execute successfully against a fresh database project with zero errors
- **SC-002**: Row-level security policies prevent cross-user data access in 100% of test scenarios
- **SC-003**: Real-time events are received by subscribed clients within 1 second of database changes
- **SC-004**: The cleanup job removes all logs older than 24 hours on each run while preserving recent logs
- **SC-005**: Endpoint lookups by slug complete in under 10ms with indexing in place
- **SC-006**: All data integrity constraints (NOT NULL, UNIQUE, CHECK, FK CASCADE) are enforced by the database and cannot be bypassed by application code
