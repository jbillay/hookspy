# Research: Database Schema & Supabase Setup

**Feature**: 002-database-schema
**Date**: 2026-02-09

## Decision 1: Migration File Conventions

**Decision**: Use `YYYYMMDDHHmmss_description.sql` format in `supabase/migrations/`

**Rationale**: This is the standard Supabase CLI convention. Timestamps ensure chronological execution order and serve as unique identifiers. Supabase tracks applied migrations in `supabase_migrations.schema_migrations`.

**Alternatives considered**:
- Sequential numbering (001_, 002_) — not supported by Supabase CLI
- Single migration file — harder to maintain and reason about

**Key details**:
- Format: `20260209120000_create_endpoints_table.sql`
- Run locally: `supabase db reset` or `supabase migration up`
- Run in production: `supabase db push`
- Split into logical migration files: tables first, then RLS, then realtime, then cron

## Decision 2: RLS Policy Patterns

**Decision**: Use inverted subquery pattern for webhook_logs policies. Use `USING` for SELECT/DELETE and `WITH CHECK` for INSERT/UPDATE.

**Rationale**: Subqueries in RLS execute per-row. The inverted pattern (`endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())`) performs significantly better than the naive approach because PostgreSQL can optimize it as an initPlan that caches the result set.

**Alternatives considered**:
- Naive subquery (`auth.uid() IN (SELECT user_id FROM endpoints WHERE id = endpoint_id)`) — executes per-row, poor performance
- Security definer function — adds complexity, overkill for this scale
- Denormalizing `user_id` into webhook_logs — violates normalization, adds update complexity

**Key details**:
- Endpoints: direct `auth.uid() = user_id` check (simple, fast)
- Webhook_logs SELECT: `endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid())`
- Webhook_logs UPDATE: same inverted pattern with both `USING` and `WITH CHECK`
- No DELETE policy on webhook_logs (cleanup job runs as service role)
- Ensure `endpoints(user_id)` index exists for RLS performance

## Decision 3: Realtime Publication

**Decision**: Use `ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;` in migration

**Rationale**: The `supabase_realtime` publication already exists in every Supabase project. Adding tables to it is the standard approach, works in migrations, and doesn't require superuser privileges. Realtime events are automatically filtered by RLS policies.

**Alternatives considered**:
- Creating a new publication — requires superuser, unnecessary
- Dashboard UI toggle — not reproducible in version control

**Key details**:
- Only `webhook_logs` needs Realtime (not `endpoints`)
- RLS filtering applies automatically to Realtime events
- Clients subscribe filtered by `endpoint_id` for targeted events

## Decision 4: pg_cron for Log Cleanup

**Decision**: Use `pg_cron` extension with hourly cleanup schedule

**Rationale**: pg_cron is available on all Supabase tiers including free tier. It runs directly in PostgreSQL, avoiding external dependencies. The cleanup query is simple and efficient with the `received_at` index.

**Alternatives considered**:
- Vercel Cron + Edge Function — requires paid Vercel plan, adds external dependency
- GitHub Actions scheduled workflow — adds latency, external dependency
- Application-level cleanup — unreliable, depends on user activity

**Key details**:
- Enable extension: `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;`
- Schedule: `cron.schedule('cleanup-old-webhook-logs', '0 * * * *', $$DELETE FROM public.webhook_logs WHERE received_at < now() - interval '24 hours'$$)`
- Free tier caveat: projects pause after 7 days of inactivity (breaks scheduled jobs)
- The cleanup job runs as superuser, bypassing RLS

## Decision 5: updated_at Trigger

**Decision**: Use `now()` in a reusable `BEFORE UPDATE` trigger function

**Rationale**: `now()` returns transaction start time, which is sufficient for this use case. `clock_timestamp()` provides per-statement accuracy but adds no practical value here. The trigger function is reusable across tables.

**Alternatives considered**:
- `clock_timestamp()` — unnecessary precision for this use case
- Application-level timestamp updates — unreliable, can be bypassed

**Key details**:
- Shared function: `trigger_set_updated_at()` using `NEW.updated_at = now()`
- Applied as `BEFORE UPDATE` trigger on `endpoints` table only
- `webhook_logs` does not have `updated_at` column (uses `responded_at` instead)

## Decision 6: Migration File Organization

**Decision**: Split into 4 ordered migration files for clarity and maintainability

**Rationale**: Separating concerns (tables → RLS → realtime → cron) makes each migration self-contained, easier to debug, and allows selective re-application during development.

**Files**:
1. `20260209000001_create_tables.sql` — Tables, indexes, trigger function, trigger
2. `20260209000002_enable_rls.sql` — RLS enable + all policies
3. `20260209000003_enable_realtime.sql` — Realtime publication for webhook_logs
4. `20260209000004_setup_cron_cleanup.sql` — pg_cron extension + cleanup job
