# Quickstart: Subscription Tiers & Admin Panel

**Feature**: 011-subscription-tiers-admin
**Date**: 2026-02-24

## Prerequisites

- Existing HookSpy dev environment running (specs 001-010 implemented)
- Supabase project with existing tables (endpoints, webhook_logs)
- Vercel deployment configured

## Implementation Order

### Phase 1: Database Foundation

1. **Create `profiles` table + trigger** (`20260224000001_create_profiles.sql`)
   - Table with plan/role/status columns
   - Trigger on `auth.users` INSERT to auto-create profile
   - RLS policies (self-read/write + admin access)
   - `updated_at` trigger
   - Backfill profiles for existing users

2. **Create `plan_config` table** (`20260224000002_create_plan_config.sql`)
   - Table with plan limit columns
   - Seed Free and Pro rows
   - RLS: authenticated SELECT, admin UPDATE

3. **Create `rate_limits` table** (`20260224000003_create_rate_limits.sql`)
   - Table with key/count/window_start
   - No RLS (service role only)
   - pg_cron cleanup job (hourly, delete > 5min old)

4. **Create `admin_audit_log` table** (`20260224000004_create_admin_audit_log.sql`)
   - Table with admin_id, target_user_id, action, old/new values
   - RLS: admin SELECT only

5. **Update log retention** (`20260224000005_update_log_retention.sql`)
   - Replace flat 24h cleanup with plan-aware retention
   - Join webhook_logs → endpoints → profiles to determine plan
   - Delete Free logs > 6h, Pro logs > 7d

6. **Seed admin user** (`20260224000006_seed_admin.sql`)
   - Set role = 'admin' for configured email

### Phase 2: API Middleware

7. **Create `api/_lib/plans.js`**
   - `getPlanLimits(plan)` — query plan_config with caching
   - `getUserPlan(userId)` — query profile for plan + status
   - `checkEndpointLimit(userId)` — count endpoints vs plan max
   - `checkRateLimit(endpointSlug, plan)` — atomic upsert + check
   - `requireAdmin(req)` — verify caller has admin role

8. **Modify `api/_lib/auth.js`**
   - Extend `verifyAuth()` to also return profile (plan, role, status)
   - Return 401 with `account_disabled` error if status is disabled

### Phase 3: Plan Enforcement in Existing Endpoints

9. **Modify `api/hook/[slug].js`** — Plan-based rate limits, body size, timeout
10. **Modify `api/endpoints/index.js`** — Endpoint creation limit
11. **Modify `api/endpoints/[id].js`** — Active toggle limit, strip custom headers for Free
12. **Modify `api/logs/index.js`** — Restrict search params for Free
13. **Modify `api/logs/[id]/replay.js`** — Gate for Free users

### Phase 4: Admin API

14. **Create `api/profile/index.js`** — GET/PUT user profile
15. **Create `api/admin/stats.js`** — System stats
16. **Create `api/admin/users/index.js`** — User list with search/filter/pagination
17. **Create `api/admin/users/[id]/index.js`** — User detail
18. **Create `api/admin/users/[id]/plan.js`** — Change plan (with endpoint deactivation)
19. **Create `api/admin/users/[id]/status.js`** — Enable/disable user
20. **Create `api/admin/audit-log.js`** — Audit log list

### Phase 5: Frontend Plan Awareness

21. **Create `src/composables/use-user-plan.js`** — Plan, limits, feature flags, isAdmin
22. **Modify `src/stores/auth.js`** — Fetch profile on login, expose plan/role
23. **Create `src/components/shared/ProGate.vue`** — Wrapper for gated features
24. **Create `src/components/settings/PlanBadge.vue`** — Free/Pro badge

### Phase 6: Frontend Feature Gating

25. **Modify `src/components/layout/AppHeader.vue`** — Plan badge, admin nav
26. **Modify `src/components/endpoints/EndpointForm.vue`** — Gate custom headers
27. **Modify `src/components/endpoints/EndpointCard.vue`** — Gate activate toggle
28. **Modify `src/components/logs/LogFilters.vue`** — Disable advanced filters for Free
29. **Modify `src/components/logs/LogDetail.vue`** — Gate replay button
30. **Modify `src/views/EndpointsView.vue`** — Usage indicator (3/3 endpoints)

### Phase 7: Settings Page

31. **Create `src/views/SettingsView.vue`** — Account settings with plan info
32. **Create `src/components/settings/PlanUsage.vue`** — Usage bars
33. **Create `src/components/settings/PlanComparison.vue`** — Feature comparison

### Phase 8: Admin Panel

34. **Create `src/stores/admin.js`** — Admin store
35. **Create `src/components/admin/AdminLayout.vue`** — Sidebar + content
36. **Create `src/views/AdminDashboardView.vue`** — Stats dashboard
37. **Create `src/components/admin/AdminStats.vue`** — Stats cards
38. **Create `src/views/AdminUsersView.vue`** — User management
39. **Create `src/components/admin/UserTable.vue`** — User list table
40. **Create `src/components/admin/UserActions.vue`** — Plan/status actions

### Phase 9: Routing & Guards

41. **Modify `src/router/index.js`** — Add /settings, /admin/\* routes with role guards

### Phase 10: Tests

42. **Unit tests** — plans.js helpers, use-user-plan composable, admin store
43. **API tests** — Plan enforcement, admin auth, rate limiting, feature gating
44. **Component tests** — ProGate, PlanBadge, feature gating in endpoints/logs

## Key Files Reference

| File                                                     | Purpose                                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `api/_lib/plans.js`                                      | Plan enforcement middleware (single source of logic) |
| `api/_lib/auth.js`                                       | Enhanced auth with profile/status check              |
| `src/composables/use-user-plan.js`                       | Frontend plan awareness                              |
| `src/components/shared/ProGate.vue`                      | Reusable gating wrapper                              |
| `supabase/migrations/20260224000001_create_profiles.sql` | Core profile schema                                  |

## Verification Checklist

- [ ] New user gets Free plan on registration
- [ ] Free user blocked at 4th endpoint with upgrade message
- [ ] Replay/search/headers gated for Free in both UI and API
- [ ] Rate limit returns 429 at 31st request/min for Free
- [ ] Body size returns 413 at 257KB for Free
- [ ] Admin can view users, change plans, disable accounts
- [ ] Plan changes take effect immediately
- [ ] Audit log records all admin actions
- [ ] Non-admin cannot access /admin routes or API
- [ ] Log retention: 6h Free, 7d Pro
