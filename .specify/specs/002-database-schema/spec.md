# Feature Specification: Database Schema & Supabase Setup

**Feature Branch**: `002-database-schema`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Database design requirements for webhook relay service

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Database Tables Exist and Enforce Constraints (Priority: P1)

A database administrator or developer runs the migration scripts against a fresh
Supabase project and all tables, indexes, constraints, and triggers are created
correctly.

**Why this priority**: Every feature depends on the database schema existing.

**Independent Test**: Run migrations against a clean Supabase database and verify
all tables exist with correct columns, types, and constraints using SQL queries.

**Acceptance Scenarios**:

1. **Given** a fresh Supabase project, **When** I run the migration SQL files in order, **Then** the `endpoints` and `webhook_logs` tables are created with all defined columns
2. **Given** the tables exist, **When** I insert an endpoint without a `user_id`, **Then** the insert fails with a NOT NULL constraint violation
3. **Given** the tables exist, **When** I insert two endpoints with the same `slug`, **Then** the second insert fails with a UNIQUE constraint violation
4. **Given** a webhook_log record, **When** I delete its parent endpoint, **Then** the log record is also deleted (CASCADE)

---

### User Story 2 - Row Level Security Isolates Users (Priority: P1)

An authenticated user querying the database through the Supabase client can only
see and modify their own endpoints and logs. They cannot access any other user's data.

**Why this priority**: Security and user isolation are foundational requirements.

**Independent Test**: Create two test users, create endpoints for each, and verify
each user can only read their own endpoints and associated logs.

**Acceptance Scenarios**:

1. **Given** User A has 3 endpoints and User B has 2 endpoints, **When** User A queries endpoints, **Then** User A sees only their 3 endpoints
2. **Given** User A owns Endpoint X, **When** User B tries to update Endpoint X, **Then** the update is rejected
3. **Given** User A owns Endpoint X with logs, **When** User B queries webhook_logs, **Then** User B sees zero logs for Endpoint X
4. **Given** the service role key, **When** the serverless function inserts a log, **Then** the insert succeeds regardless of RLS (service role bypasses RLS)

---

### User Story 3 - Realtime Notifications Work (Priority: P1)

When a new webhook_log record is inserted, Supabase Realtime sends a notification
to subscribed clients filtered by endpoint_id.

**Why this priority**: The browser relay depends on instant notification of new webhooks.

**Independent Test**: Subscribe to the webhook_logs table via Supabase Realtime,
insert a record, and verify the subscription receives the event.

**Acceptance Scenarios**:

1. **Given** a Realtime subscription on `webhook_logs` filtered by `endpoint_id`, **When** a new log is inserted for that endpoint, **Then** the subscription receives the INSERT event within 1 second
2. **Given** a Realtime subscription on `webhook_logs`, **When** a log's status is updated from `pending` to `responded`, **Then** the subscription receives the UPDATE event

---

### User Story 4 - Automatic Log Cleanup (Priority: P2)

Webhook logs older than 24 hours are automatically deleted by a scheduled database
job, keeping the database clean without manual intervention.

**Why this priority**: Important for cost and performance but not blocking for core functionality.

**Independent Test**: Insert logs with timestamps older than 24 hours, trigger
the cleanup function, and verify they are deleted.

**Acceptance Scenarios**:

1. **Given** webhook_logs with `received_at` older than 24 hours, **When** the cleanup cron job runs, **Then** those records are deleted
2. **Given** webhook_logs with `received_at` within the last 24 hours, **When** the cleanup cron job runs, **Then** those records are NOT deleted

---

### Edge Cases

- What happens when the slug generation produces a collision? Use `gen_random_uuid()` for guaranteed uniqueness or retry on conflict
- What happens when a very large payload is stored? Text columns have no practical size limit in Postgres, but query performance may degrade
- What happens when Realtime is not enabled on the table? The migration must explicitly enable Realtime publication on `webhook_logs`

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create an `endpoints` table with columns: `id` (uuid PK), `user_id` (uuid FK to auth.users, NOT NULL), `name` (text), `slug` (text, UNIQUE, NOT NULL), `target_url` (text, DEFAULT 'http://localhost'), `target_port` (integer, DEFAULT 3000), `target_path` (text, DEFAULT '/'), `timeout_seconds` (integer, DEFAULT 30, CHECK between 1 and 55), `custom_headers` (jsonb, DEFAULT '{}'), `is_active` (boolean, DEFAULT true), `created_at` (timestamptz, DEFAULT now()), `updated_at` (timestamptz, DEFAULT now())
- **FR-002**: System MUST create a `webhook_logs` table with columns: `id` (uuid PK), `endpoint_id` (uuid FK to endpoints ON DELETE CASCADE, NOT NULL), `status` (text, NOT NULL, CHECK in 'pending','forwarding','responded','timeout','error'), `request_method` (text, NOT NULL), `request_url` (text), `request_headers` (jsonb), `request_body` (text), `response_status` (integer), `response_headers` (jsonb), `response_body` (text), `error_message` (text), `received_at` (timestamptz, DEFAULT now()), `responded_at` (timestamptz), `duration_ms` (integer)
- **FR-003**: System MUST create an index on `webhook_logs(endpoint_id, received_at DESC)` for efficient log listing
- **FR-004**: System MUST create an index on `endpoints(slug)` for fast webhook URL lookup
- **FR-005**: System MUST create an index on `endpoints(user_id)` for fast user endpoint listing
- **FR-006**: System MUST create a trigger on `endpoints` to automatically update the `updated_at` column on row modification
- **FR-007**: System MUST enable RLS on both tables with policies: endpoints SELECT/INSERT/UPDATE/DELETE restricted to `auth.uid() = user_id`; webhook_logs SELECT/UPDATE restricted to rows where the endpoint's `user_id = auth.uid()`
- **FR-008**: System MUST enable Supabase Realtime publication on the `webhook_logs` table
- **FR-009**: System MUST create a pg_cron job (or equivalent) that deletes webhook_logs where `received_at < now() - interval '24 hours'`, running every hour
- **FR-010**: System MUST create all schema objects via numbered SQL migration files in `supabase/migrations/`

### Key Entities

- **endpoints**: Represents a user's webhook receiving URL with forwarding configuration
- **webhook_logs**: Represents a single webhook request/response lifecycle (pending through responded/timeout/error)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All migration files execute successfully against a fresh Supabase project with zero errors
- **SC-002**: RLS policies prevent cross-user data access in 100% of test scenarios
- **SC-003**: Realtime events are received within 1 second of database changes
- **SC-004**: The cleanup cron job removes all logs older than 24 hours on each run
- **SC-005**: Endpoint slug lookups complete in under 5ms with the index in place
