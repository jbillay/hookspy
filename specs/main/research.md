# Research: Subscription Tiers & Admin Panel

**Feature**: 011-subscription-tiers-admin
**Date**: 2026-02-24

## Research Items

### R1: Supabase Auth Trigger for Profile Creation

**Decision**: Use a PostgreSQL trigger function on `auth.users` INSERT to auto-create a profile row.

**Rationale**: Supabase Auth manages `auth.users` internally. A database trigger is the most reliable way to create a profile on signup without modifying the frontend registration flow. The trigger fires synchronously within the signup transaction, ensuring profile exists before the first API call.

**Implementation**:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Alternatives considered**:

- Frontend-initiated profile creation after signup → Race condition risk; profile might not exist when first API call fires
- Lazy creation in API middleware → Adds latency to every authenticated request; complex error handling

### R2: RLS Policies for Admin Access

**Decision**: Use role-based RLS policies where admin check queries the `profiles` table for the calling user's role.

**Rationale**: Keeps authorization in the database layer. Admin API endpoints use the anon client with user JWT, so RLS policies naturally enforce access. Avoids relying on service role key for admin operations.

**Implementation pattern**:

```sql
-- Admin can read all profiles
CREATE POLICY "admins_select_all_profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id  -- own profile
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**Alternatives considered**:

- Service role bypass for all admin queries → Loses RLS guarantees; any bug in admin middleware leaks all data
- Custom JWT claims for role → Requires Supabase Auth hooks (paid feature) or manual token minting; overcomplicated

**Performance note**: The `EXISTS` subquery on profiles is a single index lookup on PK (`id`). No measurable impact at <1000 users.

### R3: Rate Limiting in Supabase (Fixed Tumbling Window)

**Decision**: Use a `rate_limits` table with atomic upsert, keyed by `slug:YYYYMMDD-HHmm` (1-minute tumbling window).

**Rationale**: Simple, no external dependencies (no Redis). The existing webhook receiver already has in-memory rate limiting (60 req/min per instance), but this is unreliable with multiple serverless instances. Database-backed rate limiting is consistent across instances.

**Implementation**:

```sql
-- Atomic upsert for rate check + increment
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

The returned `count` is compared to the plan's `requests_per_min`. If exceeded, return 429.

**Alternatives considered**:

- In-memory rate limiting (current) → Not consistent across serverless instances
- Redis/Upstash → External dependency; adds cost and complexity
- Supabase Edge Functions with Deno KV → Different runtime; doesn't align with Vercel serverless

**Cleanup**: Hourly pg_cron job deletes rows where `window_start < now() - interval '5 minutes'`.

### R4: Plan Config as Database Table vs Code Constants

**Decision**: Store plan limits in a `plan_config` Supabase table, fetched at runtime.

**Rationale**: User chose this approach to allow changing limits without redeploying. Both API and frontend query this table. API caches per-invocation (serverless functions are short-lived, so in-memory cache is naturally short-TTL). Frontend caches in the `useUserPlan` composable, refreshed on login and plan change.

**Implementation**:

- `plan_config` table with PK on `plan` (text)
- RLS: SELECT for all authenticated users, UPDATE/INSERT for admins only
- Seed migration populates Free and Pro rows
- `getPlanLimits(plan)` in `api/_lib/plans.js` queries with service role (for webhook receiver, which runs unauthenticated) or anon client (for authenticated endpoints)

**Alternatives considered**:

- Shared JS constants file → Requires redeploy to change limits
- Environment variables → Limited structure; hard to represent boolean flags

### R5: Admin Seeding Strategy

**Decision**: Migration seeds admin by email. Uses a placeholder email that should be replaced before running.

**Rationale**: Simple, deterministic, works in any environment. The migration checks if the profile exists (user already registered) and updates role, or logs a notice if the user hasn't registered yet.

**Implementation**:

```sql
-- Replace with actual admin email before running
DO $$
DECLARE
  admin_email TEXT := 'admin@example.com';  -- CHANGE THIS
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles SET role = 'admin' WHERE id = admin_id;
    RAISE NOTICE 'Admin role assigned to %', admin_email;
  ELSE
    RAISE NOTICE 'User % not found. Register first, then run: UPDATE profiles SET role = ''admin'' WHERE email = ''%''', admin_email, admin_email;
  END IF;
END $$;
```

**Alternatives considered**:

- Environment variable in migration → Supabase migrations don't support env var interpolation natively
- Auto-promote first user → Insecure in production

### R6: Lazy Session Invalidation for Disabled Users

**Decision**: Extend `verifyAuth()` to check `profiles.status` after JWT validation. Return 401 if disabled.

**Rationale**: Supabase Auth doesn't support server-initiated session revocation without banning the user (which is irreversible without admin API). Lazy invalidation is simpler: the next API call checks status and returns 401. The frontend auth store handles 401 by signing out.

**Implementation**:

```javascript
// In api/_lib/auth.js - enhanced verifyAuth
export async function verifyAuth(req) {
  // ... existing JWT validation ...
  const { data: profile } = await supabase
    .from('profiles')
    .select('status, plan, role')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'disabled') {
    return { user: null, error: 'account_disabled', profile: null }
  }
  return { user, error: null, profile }
}
```

**Alternatives considered**:

- Supabase Auth ban → Permanent; requires admin API to unban; heavy-handed for temporary disable
- Force token revocation → Not supported by Supabase Auth without custom token management

### R7: Endpoint Deactivation on Plan Downgrade

**Decision**: Auto-deactivate most recently created endpoints when a Pro→Free downgrade causes the user to exceed the Free endpoint limit.

**Rationale**: Deleting endpoints would lose configuration. Deactivating preserves data while enforcing limits. Most-recent-first is deterministic and preserves the user's oldest (likely most important) endpoints.

**Implementation**: In the `PUT /api/admin/users/:id/plan` handler:

1. Update profile plan
2. Count user's active endpoints
3. If active > new plan max, deactivate excess (ORDER BY created_at DESC LIMIT excess_count)
4. Log audit entry

The user can then swap by deactivating one and activating another (toggle checks active count ≤ plan max).

## Summary

All research items resolved. No NEEDS CLARIFICATION items remain. Ready for Phase 1 design.
