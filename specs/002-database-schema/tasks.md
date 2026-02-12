# Tasks: Database Schema & Supabase Setup

**Input**: Design documents from `specs/002-database-schema/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `supabase/migrations/` directory structure and shared trigger function

- [x] T001 Create `supabase/migrations/` directory structure at repository root
- [x] T002 Create the reusable `trigger_set_updated_at()` function and `endpoints` table with all columns (id, user_id, name, slug, target_url, target_port, target_path, timeout_seconds, custom_headers, is_active, created_at, updated_at), indexes (idx_endpoints_slug, idx_endpoints_user_id), and BEFORE UPDATE trigger in `supabase/migrations/20260209000001_create_tables.sql`

**Checkpoint**: Directory structure exists, endpoints table migration is ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete the tables migration file with webhook_logs — MUST be complete before any user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `webhook_logs` table with all columns (id, endpoint_id, status, request_method, request_url, request_headers, request_body, response_status, response_headers, response_body, error_message, received_at, responded_at, duration_ms), FK to endpoints ON DELETE CASCADE, status CHECK constraint, and composite index (endpoint_id, received_at DESC) to `supabase/migrations/20260209000001_create_tables.sql`

**Checkpoint**: Both tables defined in migration 1 with all columns, constraints, indexes, and trigger. Migration 1 is complete and ready to execute.

---

## Phase 3: User Story 1 - Database Tables Exist and Enforce Constraints (Priority: P1)

**Goal**: All tables, indexes, constraints, and triggers are created correctly when migrations run against a fresh Supabase project. Data integrity is enforced at the database level.

**Independent Test**: Run migration file 1 against a clean Supabase database using `supabase db push` or SQL editor. Verify:

- Both tables exist with correct columns and types
- `slug` UNIQUE constraint rejects duplicates
- `user_id` NOT NULL constraint rejects null inserts
- `status` CHECK constraint rejects invalid values
- `timeout_seconds` CHECK constraint rejects values outside 1-55
- CASCADE delete removes child webhook_logs when parent endpoint is deleted
- `updated_at` trigger fires on endpoint UPDATE

### Implementation for User Story 1

- [x] T004 [US1] Validate `supabase/migrations/20260209000001_create_tables.sql` against the SQL contract in `specs/002-database-schema/contracts/database-schema.sql` — ensure the `endpoints` table has all 12 columns with correct types, defaults, and constraints per FR-001
- [x] T005 [US1] Validate `supabase/migrations/20260209000001_create_tables.sql` — ensure the `webhook_logs` table has all 14 columns with correct types, defaults, and constraints per FR-002
- [x] T006 [US1] Validate indexes exist: `idx_endpoints_slug` on endpoints(slug), `idx_endpoints_user_id` on endpoints(user_id), `idx_webhook_logs_endpoint_received` on webhook_logs(endpoint_id, received_at DESC) per FR-003/FR-004/FR-005
- [x] T007 [US1] Validate trigger: `trigger_set_updated_at()` function exists and `set_updated_at` BEFORE UPDATE trigger is attached to `endpoints` table per FR-006
- [x] T008 [US1] Run migration 1 against a Supabase project and verify all acceptance scenarios: NOT NULL on user_id, UNIQUE on slug, CHECK on status, CHECK on timeout_seconds (0 and 56 rejected), CASCADE delete from endpoints to webhook_logs

**Checkpoint**: User Story 1 complete — migration 1 creates all tables, indexes, constraints, and trigger successfully

---

## Phase 4: User Story 2 - Row Level Security Isolates Users (Priority: P1)

**Goal**: RLS policies enforce complete data isolation between users. Authenticated users can only access their own endpoints and logs. Service role bypasses RLS for serverless function operations.

**Independent Test**: Enable RLS migration, create two test users in Supabase Auth, create endpoints for each, and verify each user only sees their own data. Verify service role can insert webhook_logs regardless of RLS.

### Implementation for User Story 2

- [x] T009 [US2] Create `supabase/migrations/20260209000002_enable_rls.sql` — enable RLS on both `endpoints` and `webhook_logs` tables with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [x] T010 [US2] Add endpoints RLS policies to `supabase/migrations/20260209000002_enable_rls.sql`: SELECT (`auth.uid() = user_id`), INSERT (WITH CHECK `auth.uid() = user_id`), UPDATE (USING + WITH CHECK `auth.uid() = user_id`), DELETE (USING `auth.uid() = user_id`) — all scoped to `authenticated` role per FR-007
- [x] T011 [US2] Add webhook_logs RLS policies to `supabase/migrations/20260209000002_enable_rls.sql`: SELECT (USING inverted subquery `endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())`), UPDATE (USING + WITH CHECK same inverted subquery) — no INSERT or DELETE policies per FR-007 and clarification
- [x] T012 [US2] Run migration 2 against Supabase project and verify acceptance scenarios: User A sees only own endpoints, User B cannot update User A's endpoint, User B sees zero logs for User A's endpoints, service role INSERT succeeds

**Checkpoint**: User Story 2 complete — RLS policies enforce user data isolation on both tables

---

## Phase 5: User Story 3 - Realtime Notifications Work (Priority: P1)

**Goal**: Supabase Realtime sends push notifications to subscribed browser clients when webhook_logs records are inserted or updated, filtered by endpoint_id.

**Independent Test**: Subscribe to webhook_logs Realtime channel filtered by endpoint_id, insert a record via service role, and verify the INSERT event is received. Update status from `pending` to `responded` and verify the UPDATE event is received.

### Implementation for User Story 3

- [x] T013 [US3] Create `supabase/migrations/20260209000003_enable_realtime.sql` — add `webhook_logs` to the `supabase_realtime` publication with `ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs` per FR-008
- [x] T014 [US3] Run migration 3 against Supabase project and verify: webhook_logs appears in `pg_publication_tables` for `supabase_realtime`, Realtime INSERT event received within 1 second of inserting a log, Realtime UPDATE event received when status changes

**Checkpoint**: User Story 3 complete — Realtime events fire on webhook_logs INSERT and UPDATE

---

## Phase 6: User Story 4 - Automatic Log Cleanup (Priority: P2)

**Goal**: A scheduled pg_cron job runs every hour and deletes webhook_logs older than 24 hours, keeping the database clean without manual intervention.

**Independent Test**: Insert logs with `received_at` older than 24 hours and logs within 24 hours. Run the cleanup SQL manually (or wait for cron). Verify old logs are deleted and recent logs remain.

### Implementation for User Story 4

- [x] T015 [US4] Create `supabase/migrations/20260209000004_setup_cron_cleanup.sql` — enable pg_cron extension with `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog` and schedule hourly cleanup job with `cron.schedule('cleanup-old-webhook-logs', '0 * * * *', $$DELETE FROM public.webhook_logs WHERE received_at < now() - interval '24 hours'$$)` per FR-009
- [x] T016 [US4] Run migration 4 against Supabase project and verify: pg_cron extension is enabled, job appears in `cron.job` table with correct schedule, manually execute cleanup SQL to confirm old logs are deleted and recent logs preserved

**Checkpoint**: User Story 4 complete — pg_cron cleanup job is scheduled and functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all migrations and documentation

- [x] T017 Run all 4 migrations in sequence against a fresh Supabase project (`supabase db push` or `supabase db reset`) and verify zero errors per SC-001
- [x] T018 Run quickstart.md validation checklist in `specs/002-database-schema/quickstart.md` — verify all items pass
- [x] T019 Verify migration file naming follows Supabase CLI timestamp convention (`YYYYMMDDHHmmss_description.sql`) per FR-010

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — T003 extends the migration file from T002
- **User Story 1 (Phase 3)**: Depends on Phase 2 — validates the completed migration 1
- **User Story 2 (Phase 4)**: Depends on Phase 2 — creates migration 2 (needs tables from migration 1)
- **User Story 3 (Phase 5)**: Depends on Phase 2 — creates migration 3 (needs tables from migration 1)
- **User Story 4 (Phase 6)**: Depends on Phase 2 — creates migration 4 (needs tables from migration 1)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational phase only — validates migration 1
- **User Story 2 (P1)**: Depends on Foundational phase only — independent migration file
- **User Story 3 (P1)**: Depends on Foundational phase only — independent migration file
- **User Story 4 (P2)**: Depends on Foundational phase only — independent migration file

### Within Each User Story

- Create migration SQL → Validate against contract → Run and verify acceptance scenarios

### Parallel Opportunities

- **Phase 4, 5, 6 (US2, US3, US4)**: Migration files 2, 3, 4 are independent files and can be created in parallel after Phase 2 completes
- T009/T010/T011 (US2), T013 (US3), and T015 (US4) can all run in parallel — they write to different files

---

## Parallel Example: User Stories 2, 3, 4

```bash
# After Phase 2 (Foundational) completes, launch all three migration files in parallel:
Task: "Create RLS migration in supabase/migrations/20260209000002_enable_rls.sql"
Task: "Create Realtime migration in supabase/migrations/20260209000003_enable_realtime.sql"
Task: "Create pg_cron migration in supabase/migrations/20260209000004_setup_cron_cleanup.sql"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004-T008) — validate tables and constraints
4. **STOP and VALIDATE**: Run migration 1 against Supabase, verify all constraints work
5. Tables are ready for other features to build on

### Incremental Delivery

1. Complete Setup + Foundational → Migration 1 ready
2. Add User Story 1 → Validate migration 1 → Tables work (MVP!)
3. Add User Story 2 → RLS policies active → Data isolation enforced
4. Add User Story 3 → Realtime enabled → Browser can subscribe
5. Add User Story 4 → Cleanup scheduled → Logs auto-expire
6. Each migration adds functionality without breaking previous migrations

### Parallel Strategy

After Foundational phase:

- Migration 2 (RLS), Migration 3 (Realtime), Migration 4 (Cron) can be written simultaneously
- Final validation (Phase 7) runs all migrations end-to-end

---

## Notes

- All tasks write SQL migration files — no application code modified in this feature
- FR-011 (10 endpoint limit) is explicitly app-layer — no database task needed
- Migration files must be idempotent-safe where possible (use IF NOT EXISTS patterns)
- The `supabase/` directory does not yet exist and is created in T001
- Commit after each migration file is complete for clean git history
