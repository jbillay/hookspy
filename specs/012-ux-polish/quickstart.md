# Implementation Quickstart: UX Polish & Improvements

**Feature Branch**: `012-ux-polish`
**Date**: 2026-03-02

## Prerequisites

- Node.js 18+, npm
- Supabase project with access to run migrations
- `npm install --legacy-peer-deps` (existing requirement)

## New Dependency

```bash
npm install driver.js --legacy-peer-deps
```

driver.js (~6KB gzipped) — lightweight step-by-step tour overlay library.

## Database Migration

Apply to Supabase (one new column):

```sql
-- Migration: add_onboarding_completed
ALTER TABLE profiles
ADD COLUMN onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
```

Save as `supabase/migrations/[timestamp]_add_onboarding_completed.sql`.

## Implementation Order (Recommended)

### Phase A: P1 Fixes (High Priority)

1. **Settings page blank-on-navigation** (FR-001)
   - File: `src/views/SettingsView.vue`
   - Add `watch` on `auth.profile` to reactively set `displayName`
   - Add loading guard while `auth.loading` is true

2. **Landing page pricing alignment** (FR-002, FR-003, FR-004)
   - File: `src/views/HomeView.vue`
   - Update Free card: "3 endpoints", "6-hour log retention"
   - Update Pro card: "5 EUR/month", actual feature list, active CTA

3. **Endpoint limit explanation** (FR-005, FR-006)
   - File: `src/views/EndpointsView.vue`
   - Add text next to progress bar: "Free plan: 3 endpoints"
   - Add "Upgrade to Pro" link, upgrade CTA when at limit

### Phase B: P2 Improvements (Medium Priority)

4. **Landing page CTAs and anchor links** (FR-007, FR-008, FR-009)
   - Files: `HomeView.vue`, `LoginView.vue`, `RegisterView.vue`
   - Wire CTA buttons to scroll or navigate
   - Make logo on auth pages link to `/`

5. **Connection status "Connecting..."** (FR-010)
   - File: `src/components/relay/RelayStatus.vue`
   - Add connecting state when transport is initializing

6. **Onboarding tour** (FR-011)
   - File: `src/views/DashboardView.vue` (trigger)
   - New composable: `src/composables/use-onboarding.js`
   - Check `auth.profile.onboarding_completed_at`
   - Use driver.js to highlight: webhook URL copy, paste instruction, keep open, send test
   - On completion: update profiles via Supabase client

7. **Destructive action confirmations** (FR-012, FR-013)
   - Files: `EndpointsView.vue`, `SettingsView.vue`
   - Endpoint delete: PrimeVue `useConfirm()` + `ConfirmDialog`
   - Account delete: existing dialog + require typing "DELETE"

8. **Auth UX improvements** (FR-014, FR-015, FR-028)
   - Files: `RegisterView.vue`, `LoginView.vue`
   - Password requirements helper text
   - User-friendly error message mapping
   - "Forgot password?" link using Supabase `resetPasswordForEmail()`

9. **Form feedback** (FR-016, FR-017, FR-018, FR-027)
   - File: `SettingsView.vue`
   - Toast on profile save success/error
   - Helper text for disabled Change Password button
   - Helper text for disabled email field
   - Files: `EndpointForm.vue`, `EndpointEditDialog.vue`
   - Add `:use-grouping="false"` to port InputNumber

10. **Log empty states and retention** (FR-019, FR-020)
    - File: Logs view component
    - Add guidance text + curl example in empty state
    - Align retention messaging with plan config

11. **Mobile improvements** (FR-021, FR-022, FR-023)
    - Files: `AppHeader.vue`, `HomeView.vue`
    - Scrollable webhook URL container
    - User email + PlanBadge in mobile menu
    - Landing page mobile hamburger nav

### Phase C: P3 Polish (Low Priority)

12. **Dashboard endpoint links** (FR-024)
    - File: `DashboardView.vue` — make endpoint names clickable

13. **Duplicate endpoint** (FR-025)
    - File: `EndpointsView.vue` — add duplicate action

14. **Pro filter tooltips** (FR-026)
    - File: Log filters component — tooltip on Pro-only filter click

15. **Dark mode persistence** (FR-029)
    - Already implemented — verify only

## Testing

- Unit tests for SettingsView loading behavior
- Unit tests for onboarding composable logic
- Manual verification for all UI changes (landing page, mobile, forms)
- Run `npm run test` before committing

## Key Files Summary

| File                                              | Changes                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/views/SettingsView.vue`                      | Loading state, save toast, password helper, email helper, delete confirmation |
| `src/views/HomeView.vue`                          | Pricing copy, CTAs, anchor links, mobile nav                                  |
| `src/views/DashboardView.vue`                     | Onboarding tour trigger, endpoint name links                                  |
| `src/views/EndpointsView.vue`                     | Limit explanation, upgrade CTA, delete confirmation, duplicate action         |
| `src/views/LoginView.vue`                         | Forgot password link, logo link                                               |
| `src/views/RegisterView.vue`                      | Password requirements, error messages, logo link                              |
| `src/components/layout/AppHeader.vue`             | Mobile menu user info                                                         |
| `src/components/relay/RelayStatus.vue`            | Connecting state                                                              |
| `src/components/endpoints/EndpointForm.vue`       | Port number formatting                                                        |
| `src/components/endpoints/EndpointEditDialog.vue` | Port number formatting                                                        |
| `src/composables/use-onboarding.js`               | New — onboarding tour logic                                                   |
| `supabase/migrations/`                            | New — add onboarding_completed_at column                                      |
