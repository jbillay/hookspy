# API Contracts: UX Polish & Improvements

**Feature Branch**: `012-ux-polish`
**Date**: 2026-03-02

## No New API Endpoints Required

This feature is entirely client-side UI/UX work with one database schema change (new column on `profiles` table). No new serverless API endpoints are needed.

### Existing Endpoints Used (unchanged)

| Endpoint              | Method | Usage in this feature                                                                                       |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `/api/profile`        | GET    | Returns profile data including new `onboarding_completed_at` field (automatic — already returns `SELECT *`) |
| `/api/profile`        | PUT    | Could be used to persist onboarding completion (alternative to direct Supabase client update)               |
| `/api/endpoints`      | GET    | Endpoint list with count for limit display                                                                  |
| `/api/endpoints`      | POST   | Endpoint creation (triggers onboarding check)                                                               |
| `/api/endpoints/[id]` | DELETE | Endpoint deletion (now with confirmation dialog)                                                            |

### Onboarding Completion Persistence

**Approach**: Use the Supabase client directly from the browser to update `profiles.onboarding_completed_at`. This avoids adding logic to the `/api/profile` endpoint and stays within Vercel's 12 serverless function limit.

```javascript
// From use-onboarding.js composable
const { client } = useSupabase()
await client
  .from('profiles')
  .update({ onboarding_completed_at: new Date().toISOString() })
  .eq('id', auth.user.id)
```

RLS policies on the `profiles` table already allow authenticated users to update their own row.
