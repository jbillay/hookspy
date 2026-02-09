# Quickstart: Authentication

**Feature**: 003-authentication
**Date**: 2026-02-09

## Prerequisites

- Node.js and npm installed
- Supabase project created with Auth enabled
- Environment variables set in `.env`:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  ```

## Implementation Order

### Phase 1: Auth Infrastructure

1. Create Pinia auth store (`src/stores/auth.js`)
2. Create useAuth composable (`src/composables/use-auth.js`)
3. Initialize auth on app startup (`src/main.js`)
4. Create server-side auth helper (`api/_lib/auth.js`)

### Phase 2: Auth UI

5. Create LoginView (`src/views/LoginView.vue`)
6. Create RegisterView (`src/views/RegisterView.vue`)
7. Update AppLayout with AppHeader showing user email + logout button

### Phase 3: Route Protection

8. Add login/register/dashboard routes to router
9. Add `beforeEach` navigation guard with redirect query parameter
10. Wire up "Get Started" button on HomeView

### Phase 4: Testing

11. Unit tests for auth store
12. Unit tests for useAuth composable
13. Unit tests for auth helper (server-side)

## Key Files

| File                                  | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `src/stores/auth.js`                  | Pinia store: user, session, loading state + actions |
| `src/composables/use-auth.js`         | Thin wrapper around auth store for component use    |
| `src/views/LoginView.vue`             | Login form with email/password                      |
| `src/views/RegisterView.vue`          | Registration form with email/password/confirm       |
| `src/views/DashboardView.vue`         | Post-login landing page (placeholder)               |
| `src/components/layout/AppHeader.vue` | Header with user email + logout button              |
| `src/router/index.js`                 | Routes + beforeEach guard                           |
| `api/_lib/auth.js`                    | Server-side JWT verification helper                 |

## Verification

After implementation, verify:

1. `npm run dev` — app starts without errors
2. Navigate to `/register` — create account, redirected to dashboard
3. Click logout — redirected to login
4. Navigate to `/login` — login with credentials, redirected to dashboard
5. Close browser, reopen — session persists
6. Navigate to `/endpoints` while logged out — redirected to `/login?redirect=/endpoints`
7. Login — redirected back to `/endpoints`
8. `npm run test` — all auth tests pass
9. `npm run lint` — no linting errors
