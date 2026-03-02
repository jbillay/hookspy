# Data Model: UX Polish & Improvements

**Feature Branch**: `012-ux-polish`
**Date**: 2026-03-02

## Entity Changes

### profiles (existing table — 1 new column)

| Column                  | Type        | Default | Notes                                                                           |
| ----------------------- | ----------- | ------- | ------------------------------------------------------------------------------- |
| onboarding_completed_at | TIMESTAMPTZ | NULL    | Set when user completes or dismisses the onboarding tour. NULL = not completed. |

**Migration SQL**:

```sql
ALTER TABLE profiles
ADD COLUMN onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
```

**Behavior**:

- On tour completion or dismissal → set to `NOW()`
- On profile fetch (GET /api/profile) → include in response (already returns `SELECT *`)
- On new user creation → defaults to NULL (trigger unchanged)

### No Other Entity Changes

All other changes in this feature are client-side only:

- Landing page pricing copy (static HTML)
- Settings page loading state (Vue reactivity)
- Form feedback (toasts, helper text)
- Mobile menu layout (template changes)
- Onboarding tour UI (driver.js overlay — client-side only)
- Confirmation dialogs (PrimeVue ConfirmDialog — client-side only)

## API Impact

No new API endpoints are needed. The existing `GET /api/profile` endpoint already returns all profile columns including the new `onboarding_completed_at` field.

The onboarding completion will be persisted via an update to the existing `PUT /api/profile` endpoint (or a targeted profile update through the Supabase client if updating directly).

**Option**: Add onboarding completion to the existing profile update flow:

- Client sends `PATCH` or `PUT` to `/api/profile` with `{ onboarding_completed_at: new Date().toISOString() }`
- Or use Supabase client directly from the browser (profiles table has RLS policies for authenticated users)

**Recommended**: Use the Supabase client directly from the browser to update the single column, avoiding changes to the API endpoint. The profiles table RLS policy already allows users to update their own row.
