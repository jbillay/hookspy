# Implementation Plan: Subscription Tiers & Admin Panel

**Branch**: `011-subscription-tiers-admin` | **Date**: 2026-02-24 | **Spec**: `.specify/specs/011-subscription-tiers-admin/spec.md`
**Input**: Feature specification from `.specify/specs/011-subscription-tiers-admin/spec.md`

## Summary

Introduce Free/Pro subscription tiers to HookSpy with per-plan feature gating, a `profiles` table with role/plan/status, a `plan_config` table for runtime-configurable limits, rate limiting infrastructure, an admin panel for user management, and frontend plan awareness. Admin plan assignment is manual (Stripe deferred). All plan enforcement happens at the API layer with frontend UX gating.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 20 (Vercel runtime)
**Primary Dependencies**: Vue 3 + PrimeVue 4 + Tailwind CSS 3, Pinia, Supabase JS client v2
**Storage**: Supabase PostgreSQL (profiles, plan_config, rate_limits, admin_audit_log tables)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Web (Vercel serverless + SPA)
**Project Type**: Web application (existing monorepo: `api/` + `src/`)
**Performance Goals**: Plan checks <50ms latency, admin list <2s for 1000 users
**Constraints**: Vercel 60s function timeout, no TypeScript, browser-based relay only
**Scale/Scope**: ~1000 users, 4 new DB tables, ~15 new/modified API endpoints, ~10 new Vue components, 3 new views

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status                  | Notes                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Plain JavaScript, No Exceptions | PASS                    | All new code is plain JS with ES modules                                                                                                                                                                                                                                           |
| II. Browser-as-Bridge              | PASS                    | No changes to relay mechanism; relay is plan-agnostic                                                                                                                                                                                                                              |
| III. Full HTTP Fidelity            | PASS                    | No payload transformation; header injection gating is additive-only restriction                                                                                                                                                                                                    |
| IV. Meaningful Testing             | PASS                    | Tests will cover plan enforcement logic, composables, stores, admin API auth checks                                                                                                                                                                                                |
| V. Simplicity & Minimal Scope      | PASS with justification | New tables (profiles, plan_config, rate_limits, admin_audit_log) and admin panel add scope, but subscription tiers are a direct extension of the product's single purpose. `plan_config` table adds runtime configurability justified by avoiding redeployments for limit changes. |

**Gate result: PASS** — No violations. Complexity tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (new & modified files)

```text
# Database migrations (new)
supabase/migrations/
├── 20260224000001_create_profiles.sql          # profiles table + trigger + RLS
├── 20260224000002_create_plan_config.sql        # plan_config table + seed data
├── 20260224000003_create_rate_limits.sql        # rate_limits table + cleanup
├── 20260224000004_create_admin_audit_log.sql    # audit log table + RLS
├── 20260224000005_update_log_retention.sql      # plan-aware cleanup job
├── 20260224000006_seed_admin.sql                # Admin user seed

# API - new files
api/
├── _lib/
│   └── plans.js                 # Plan enforcement middleware (getPlanLimits, getUserPlan, checkEndpointLimit, checkRateLimit)
├── admin/
│   ├── stats.js                 # GET /api/admin/stats
│   ├── users/
│   │   ├── index.js             # GET /api/admin/users
│   │   └── [id]/
│   │       ├── index.js         # GET /api/admin/users/:id
│   │       ├── plan.js          # PUT /api/admin/users/:id/plan
│   │       └── status.js        # PUT /api/admin/users/:id/status
│   └── audit-log.js             # GET /api/admin/audit-log
├── profile/
│   └── index.js                 # GET/PUT /api/profile

# API - modified files
api/
├── _lib/
│   └── auth.js                  # Add status check (lazy invalidation)
├── hook/
│   └── [slug].js                # Add plan-based rate limits, body size, timeout caps
├── endpoints/
│   └── index.js                 # Add endpoint limit check on POST
├── logs/
│   ├── index.js                 # Restrict search params for Free users
│   └── [id]/
│       └── replay.js            # Gate for Free users

# Frontend - new files
src/
├── composables/
│   └── use-user-plan.js         # Plan-aware composable
├── stores/
│   └── admin.js                 # Admin store (users, stats, audit log)
├── components/
│   ├── admin/
│   │   ├── AdminLayout.vue      # Admin sidebar + content area
│   │   ├── AdminStats.vue       # System-wide stats cards
│   │   ├── UserTable.vue        # Paginated user list with search/filter
│   │   └── UserActions.vue      # Plan change / disable actions
│   ├── settings/
│   │   ├── PlanBadge.vue        # Free/Pro badge component
│   │   ├── PlanUsage.vue        # Usage stats display
│   │   └── PlanComparison.vue   # Feature comparison table
│   └── shared/
│       └── ProGate.vue          # Wrapper that shows lock/badge for gated features
├── views/
│   ├── SettingsView.vue         # User account settings
│   ├── AdminDashboardView.vue   # Admin stats dashboard
│   └── AdminUsersView.vue       # Admin user management

# Frontend - modified files
src/
├── router/
│   └── index.js                 # Add /settings, /admin/* routes with guards
├── stores/
│   └── auth.js                  # Expose plan/role from profile; handle 401 disabled
├── components/
│   ├── layout/
│   │   └── AppHeader.vue        # Add plan badge, admin nav link
│   ├── endpoints/
│   │   ├── EndpointForm.vue     # Gate custom headers for Free
│   │   └── EndpointCard.vue     # Gate activate toggle for plan limit
│   ├── logs/
│   │   ├── LogFilters.vue       # Disable advanced filters for Free
│   │   └── LogDetail.vue        # Gate replay button for Free
│   └── dashboard/
│       └── DashboardView.vue    # Add usage indicator
```

**Structure Decision**: Extends the existing HookSpy monorepo structure. API serverless functions follow the established Vercel file-based routing convention. Frontend adds new views and components within the existing `src/` hierarchy. Admin panel lives under `src/views/Admin*` and `src/components/admin/`. No new top-level directories needed.

## Complexity Tracking

| Violation                                                                            | Why Needed                                                                                                                                                                    | Simpler Alternative Rejected Because                                                                                                                     |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Log retention changed from fixed 24h (constitution) to plan-based (6h Free / 7d Pro) | Plan differentiation requires different retention per tier. Free users get shorter retention to incentivize upgrades; Pro users get longer retention for debugging workflows. | A flat 24h for all plans provides no differentiation. Constitution should be amended to "Log retention: configurable per plan" via a follow-up patch PR. |
