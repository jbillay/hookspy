# Phase 0 Research: UX Polish & Improvements

**Feature Branch**: `012-ux-polish`
**Date**: 2026-03-02

## Research Tasks & Findings

### 1. Settings Page Blank-on-Navigation Bug (FR-001)

**Decision**: Fix race condition in SettingsView.vue by ensuring profile data is available before rendering.

**Rationale**: The root cause is in `SettingsView.vue` `onMounted()` — it reads `auth.profile?.display_name` synchronously on mount, but `auth.profile` may be `null` if the profile hasn't been fetched yet during SPA navigation. The auth store's `initAuth()` fetches profile data on `INITIAL_SESSION`, but on subsequent SPA navigations, profile data is already cached. The issue occurs when navigating to Settings before the initial profile fetch completes.

**Fix approach**: Add a `watch` on `auth.profile` in SettingsView to reactively update `displayName` when profile data arrives, and add a guard/loading state while `auth.loading` is true. Alternatively, call `await auth.fetchProfile()` in the `onMounted` hook to ensure fresh data.

**Alternatives considered**:

- Global navigation guard to await profile — too heavy, affects all routes
- Suspense component — adds complexity, not needed for a single view

### 2. Landing Page Pricing & CTA Issues (FR-002 to FR-004, FR-007, FR-008)

**Decision**: Update hardcoded pricing HTML in `HomeView.vue` to match actual plan limits from `plan_config` table.

**Rationale**: The landing page in `src/views/HomeView.vue` has all pricing information hardcoded as static HTML. The Free/Beta card shows "Unlimited endpoints" and "24-hour log retention", contradicting the actual limits (3 endpoints, 6-hour retention). The Pro card shows "TBD / Coming soon" despite Pro being live at 5 EUR/month. CTA buttons use `router-link to="/register"` which works, but some CTAs and anchor links (How it works, Features, Pricing) are non-functional.

**Fix approach**: Update the static HTML to reflect actual plan limits. Wire anchor links with `@click` handlers that use `document.getElementById(id).scrollIntoView()`. Update Pro card with actual price and features.

**Alternatives considered**:

- Fetch plan config from API at runtime — adds an API call on every landing page visit, unnecessary for rarely-changing data
- Shared constants file — good middle ground but premature for landing page

### 3. Connection Status "Connecting..." State (FR-010)

**Decision**: Add a `connecting` state to RelayStatus.vue that shows during initial WebSocket/transport setup.

**Rationale**: `RelayStatus.vue` currently has three states: `active`, `no-endpoints`, and default (`Disconnected`). The transport indicator in `useRealtimeTransport` already shows `Connecting...` for unknown transport mode, but the main relay status shows "Disconnected" during initialization. The fix is to check if the relay is in its initial loading state and show "Connecting..." instead.

**Fix approach**: Add a `connecting` case to `statusConfig` computed in RelayStatus.vue, triggered when the relay is initializing (transport mode is still `null`/unknown and endpoints exist).

**Alternatives considered**:

- Timer-based approach (show Connecting for first N seconds) — fragile, not state-based

### 4. Port Number Formatting (FR-018)

**Decision**: Add `:use-grouping="false"` to PrimeVue `InputNumber` components for port fields.

**Rationale**: PrimeVue's `InputNumber` applies locale-specific thousand separators by default, turning "3000" into "3,000". Found in `src/components/endpoints/EndpointForm.vue` and `EndpointEditDialog.vue`. The fix is a single prop addition.

**Fix approach**: Add `:use-grouping="false"` to both port InputNumber instances.

**Alternatives considered**: None needed — this is the standard PrimeVue approach.

### 5. Onboarding Tour Library (FR-011)

**Decision**: Use `driver.js` for the guided tour overlay.

**Rationale**: driver.js is a lightweight (~6KB gzipped), no-dependency library specifically designed for step-by-step highlight tours. It supports overlays, popovers, keyboard navigation, and callbacks. It's actively maintained and works with any DOM framework.

**Alternatives considered**:

- `vue-tour` — Vue-specific but less maintained, larger bundle
- `intro.js` — Heavier, commercial license for production use
- Custom implementation — unnecessary complexity for a well-solved problem

### 6. Mobile Menu User Info (FR-022)

**Decision**: Add user email and plan badge to the mobile hamburger menu in `AppHeader.vue`.

**Rationale**: The desktop header shows `auth.user?.email` and a `PlanBadge` component, but the mobile menu (lines 206-222 of AppHeader.vue) only shows nav links and a sign-out button. The `auth` store and `PlanBadge` component are already imported — just need to render them in the mobile menu template.

**Fix approach**: Add a user info section at the top of the mobile menu with email (truncated) and PlanBadge.

**Alternatives considered**: None — straightforward template addition.

### 7. Dark Mode Persistence (FR-029)

**Decision**: Already implemented — no changes needed.

**Rationale**: `AppHeader.vue` already reads `localStorage.getItem('hs-dark-mode')` on mount and writes it on toggle. The `applyDarkMode()` function toggles the `dark-mode` class on `document.documentElement`. This persists across sessions.

**Verification**: Confirmed in AppHeader.vue lines 16-29. DM1 from the UX review is already handled.

### 8. Endpoint Delete Confirmation (FR-012)

**Decision**: Add PrimeVue `ConfirmDialog` for endpoint deletion in EndpointsView.vue.

**Rationale**: PrimeVue provides `useConfirm()` composable and `ConfirmDialog` component. The endpoint delete function already exists — just need to wrap it in a confirmation step. PrimeVue's confirm service is already available in the app (imported in main.js).

**Fix approach**: Use `confirm.require()` before calling the delete API, showing endpoint name in the dialog.

**Alternatives considered**:

- Custom modal — unnecessary when PrimeVue provides a built-in solution

### 9. Profiles Table Schema (FR-011 — onboarding state)

**Decision**: Add `onboarding_completed_at TIMESTAMPTZ DEFAULT NULL` column to the profiles table.

**Rationale**: The profiles table already has: id, email, display_name, plan, role, status, plan_changed_at, stripe_customer_id, stripe_subscription_id, created_at, updated_at. Adding a nullable timestamp column is the simplest way to track onboarding completion. `NULL` = not completed, non-null = completed at that timestamp. This supports the server-side persistence requirement (FR-011).

**Fix approach**: Single Supabase migration: `ALTER TABLE profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;`

**Alternatives considered**:

- Boolean flag — less informative than a timestamp
- Separate onboarding_state table — over-engineered for a single field
- JSON preferences column — premature abstraction
