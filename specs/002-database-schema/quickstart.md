# Quickstart: Database Schema & Supabase Setup

**Feature**: 002-database-schema
**Date**: 2026-02-09

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- A Supabase project created (free tier is sufficient for development)
- Environment variables configured in `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Quick Setup

### 1. Link to Supabase Project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 2. Run Migrations

```bash
# Apply all migrations to your linked Supabase project
supabase db push

# OR for local development with Supabase local
supabase start
supabase db reset
```

### 3. Verify Tables

After running migrations, verify in the Supabase dashboard:

- **Table Editor**: `endpoints` and `webhook_logs` tables exist
- **Authentication > Policies**: RLS policies are active on both tables
- **Database > Extensions**: `pg_cron` extension is enabled
- **Database > Cron Jobs**: `cleanup-old-webhook-logs` job appears

### 4. Test RLS

Create a test user in the Supabase dashboard, then use the SQL editor:

```sql
-- As authenticated user (set role in SQL editor)
SET request.jwt.claims = '{"sub": "test-user-uuid"}';
SET role TO authenticated;

-- Should return only this user's endpoints
SELECT * FROM endpoints;
```

## Migration Files

The following migration files are created in `supabase/migrations/`:

| File                                    | Purpose                                    |
| --------------------------------------- | ------------------------------------------ |
| `20260209000001_create_tables.sql`      | Tables, indexes, trigger function, trigger |
| `20260209000002_enable_rls.sql`         | RLS enable + all policies                  |
| `20260209000003_enable_realtime.sql`    | Realtime publication for webhook_logs      |
| `20260209000004_setup_cron_cleanup.sql` | pg_cron extension + cleanup job            |

## Validation Checklist

After running migrations:

- [ ] `endpoints` table has all 12 columns with correct types
- [ ] `webhook_logs` table has all 14 columns with correct types
- [ ] `slug` UNIQUE constraint works (try inserting duplicate)
- [ ] `timeout_seconds` CHECK constraint works (try inserting 0 or 56)
- [ ] `status` CHECK constraint works (try inserting 'invalid')
- [ ] CASCADE delete works (delete endpoint, logs disappear)
- [ ] RLS blocks cross-user access
- [ ] Realtime events fire on webhook_logs INSERT/UPDATE
- [ ] pg_cron cleanup job is scheduled

## Troubleshooting

**Migrations fail with permission error**: Ensure you're linked to the correct project and have admin access.

**pg_cron not available**: Check that your Supabase project has the `pg_cron` extension enabled in Dashboard > Database > Extensions.

**Realtime events not received**: Verify `webhook_logs` is in the `supabase_realtime` publication:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```
