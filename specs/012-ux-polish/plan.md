# Implementation Plan: UX Polish & Improvements

**Branch**: `012-ux-polish` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-ux-polish/spec.md`

## Summary

Address 29 UX improvements identified in the comprehensive UX review, spanning the landing page, registration, dashboard, endpoint management, logs, settings, and mobile experience. Key deliverables: fix Settings page blank-on-navigation bug, align pricing copy across the app, add a guided onboarding tour, add confirmation dialogs for destructive actions, improve form feedback, and polish mobile navigation.

## Technical Context

**Language/Version**: JavaScript (ES modules), Vue 3 Composition API
**Primary Dependencies**: Vue 3, PrimeVue 4 (Aura), Tailwind CSS 3, Pinia, vue-router, driver.js (new — onboarding tour)
**Storage**: Supabase PostgreSQL (profiles table — add `onboarding_completed_at` column)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Web (Vercel hosting), responsive mobile
**Project Type**: Web application (Vue SPA + Vercel serverless functions)
**Performance Goals**: Settings page renders within 2s on SPA navigation; tour overlay appears within 1s of first endpoint creation
**Constraints**: Max 12 serverless functions on Vercel Hobby plan (no new endpoints needed); `npm install --legacy-peer-deps` required
**Scale/Scope**: ~15 Vue components modified, 1 new migration, 1 new npm dependency, 0 new API endpoints

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | Notes                                                                                                               |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| I. Plain JavaScript, No Exceptions | PASS   | All changes are plain JS, Vue 3 `<script setup>`, no TypeScript                                                     |
| II. Browser-as-Bridge              | PASS   | No changes to relay mechanism; onboarding tour is client-side only                                                  |
| III. Full HTTP Fidelity            | PASS   | No changes to payload forwarding; this is purely UX/UI work                                                         |
| IV. Meaningful Testing             | PASS   | Tests will cover composable behavior and store logic, not PrimeVue internals                                        |
| V. Simplicity & Minimal Scope      | PASS   | Each change addresses a specific UX finding; driver.js is lightweight (6KB); one new DB column for onboarding state |

No violations. No complexity tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-ux-polish/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: codebase research findings
├── data-model.md        # Phase 1: data model changes
├── quickstart.md        # Phase 1: implementation quickstart
├── contracts/           # Phase 1: no new API contracts needed
│   └── no-new-endpoints.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── views/
│   ├── HomeView.vue          # Landing page: pricing, CTAs, mobile nav
│   ├── SettingsView.vue      # Fix blank-on-navigation bug, form feedback
│   ├── LoginView.vue         # Forgot password link, logo link
│   ├── RegisterView.vue      # Password requirements, error messages, logo link
│   ├── EndpointsView.vue     # Limit explanation, duplicate action
│   └── DashboardView.vue     # Onboarding tour trigger, endpoint name links
├── components/
│   ├── layout/
│   │   └── AppHeader.vue     # Mobile menu user info, connection status
│   ├── endpoints/
│   │   ├── EndpointForm.vue  # Port number formatting fix
│   │   └── EndpointEditDialog.vue  # Port number formatting fix
│   └── relay/
│       └── RelayStatus.vue   # "Connecting..." state
├── composables/
│   └── use-auth.js           # Profile fetch improvements
└── stores/
    └── auth.js               # Profile data loading

api/
└── (no changes — no new serverless functions needed)

supabase/
└── migrations/
    └── [timestamp]_add_onboarding_completed.sql  # New column

tests/
└── unit/
    ├── views/                # New tests for settings loading
    └── components/           # Existing component tests updated
```

**Structure Decision**: Existing HookSpy web application structure. No new directories needed. Changes are distributed across existing Vue views, components, and one new Supabase migration.
