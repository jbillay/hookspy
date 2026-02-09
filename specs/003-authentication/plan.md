# Implementation Plan: Authentication

**Branch**: `003-authentication` | **Date**: 2026-02-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-authentication/spec.md`

## Summary

Implement email/password authentication for HookSpy using Supabase Auth. This includes a Pinia auth store, useAuth composable, login/register views with PrimeVue forms, route protection with redirect-back, server-side JWT verification helper, and an AppHeader component showing user state. Session persistence is handled automatically by the Supabase client.

## Technical Context

**Language/Version**: JavaScript (ES modules, no TypeScript)
**Primary Dependencies**: Vue 3, Pinia 3, Vue Router 5, PrimeVue 4, @supabase/supabase-js 2
**Storage**: Supabase Auth (auth.users) + browser localStorage (sessions)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Web (SPA hosted on Vercel)
**Project Type**: Web application (frontend SPA + serverless API)
**Performance Goals**: Auth operations complete within 2 seconds; route guard checks are instant (localStorage read)
**Constraints**: No TypeScript, no social login, no email confirmation, no password reset (deferred)
**Scale/Scope**: Single-user sessions, 10 endpoints per user max

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                                   |
| ----------------------------- | ------ | ----------------------------------------------------------------------- |
| I. Plain JavaScript           | PASS   | All code is plain JS with ES modules                                    |
| II. Browser-as-Bridge         | PASS   | Auth is browser-native; no CLI/daemon involved                          |
| III. Full HTTP Fidelity       | N/A    | Auth feature does not touch webhook payloads                            |
| IV. Meaningful Testing        | PASS   | Tests cover store, composable, and auth helper — not PrimeVue internals |
| V. Simplicity & Minimal Scope | PASS   | Only email/password auth; no social login, MFA, or password reset       |

**Post-Phase 1 Re-check**: All principles remain satisfied. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-authentication/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── auth-api.md      # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── stores/
│   └── auth.js              # NEW: Pinia auth store
├── composables/
│   ├── use-supabase.js      # EXISTS: Supabase client singleton
│   └── use-auth.js          # NEW: Auth composable wrapping store
├── views/
│   ├── HomeView.vue         # MODIFY: Wire up "Get Started" button
│   ├── LoginView.vue        # NEW: Login form
│   ├── RegisterView.vue     # NEW: Registration form
│   └── DashboardView.vue    # NEW: Post-login placeholder
├── components/
│   └── layout/
│       ├── AppLayout.vue    # MODIFY: Conditional header for auth pages
│       └── AppHeader.vue    # NEW: Header with user email + logout
├── router/
│   └── index.js             # MODIFY: Add routes + beforeEach guard
├── main.js                  # MODIFY: Initialize auth on startup
└── App.vue                  # EXISTS: No changes needed

api/
└── _lib/
    ├── supabase.js          # EXISTS: Server-side Supabase client
    └── auth.js              # NEW: JWT verification helper

tests/
└── unit/
    ├── stores/
    │   └── auth.test.js     # NEW: Auth store tests
    ├── composables/
    │   └── use-auth.test.js # NEW: Auth composable tests
    └── api/
        └── auth.test.js     # NEW: Server-side auth helper tests
```

**Structure Decision**: Follows the existing project structure defined in CLAUDE.md. No new directories beyond what's already planned. Auth-specific code lives in the standard locations (stores, composables, views, api/\_lib).

## Complexity Tracking

No constitution violations. Table intentionally left empty.
