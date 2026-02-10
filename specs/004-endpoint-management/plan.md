# Implementation Plan: Endpoint Management

**Branch**: `004-endpoint-management` | **Date**: 2026-02-09 | **Spec**: `specs/004-endpoint-management/spec.md`
**Input**: Feature specification from `/specs/004-endpoint-management/spec.md`

## Summary

Implement full CRUD for webhook endpoints: Vercel serverless API functions (`api/endpoints/`), a Pinia store, Vue views (list + create/edit), and supporting components (EndpointCard, EndpointForm, HeaderInjectionEditor). Includes validation, clipboard copy, active/inactive toggle, delete confirmation, and empty state. All protected by JWT auth.

## Technical Context

**Language/Version**: JavaScript (ES2022), Vue 3.5, Node.js 20
**Primary Dependencies**: Vue 3, Pinia 3, Vue Router 5, PrimeVue 4 (Aura), Tailwind CSS 3, Supabase JS v2
**Storage**: Supabase PostgreSQL (endpoints table with RLS, custom_headers as JSONB)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Web (Vercel hosting, SPA with serverless API)
**Project Type**: Web application (frontend SPA + serverless backend)
**Performance Goals**: N/A (developer tool, low concurrency)
**Constraints**: 55s max timeout per Vercel limit, service role key server-side only
**Scale/Scope**: No endpoint limit per user, JSONB for flexible header storage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Plain JavaScript | PASS | All code is plain JS with ES modules |
| II. Browser-as-Bridge | PASS | Endpoint management is UI + API only; no CLI/tunnel |
| III. Full HTTP Fidelity | PASS | Custom headers are additive only (stored in JSONB, merged at relay time) |
| IV. Meaningful Testing | PASS | Tests cover store, API handlers, and form validation logic |
| V. Simplicity & YAGNI | PASS | Minimal CRUD + config; no unnecessary abstractions |

All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-endpoint-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── endpoints-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
api/
├── endpoints/
│   ├── index.js         # GET (list) / POST (create)
│   └── [id].js          # GET / PUT / DELETE single endpoint
└── _lib/
    ├── supabase.js      # (existing)
    ├── auth.js          # (existing)
    └── cors.js          # CORS helper (new)

src/
├── stores/
│   └── endpoints.js     # Pinia store for endpoints
├── composables/
│   └── use-endpoints.js # Thin wrapper around endpoints store
├── views/
│   ├── EndpointsView.vue       # List view with cards + empty state
│   └── EndpointDetailView.vue  # Create/edit form view
├── components/
│   └── endpoints/
│       ├── EndpointCard.vue           # Card for list view
│       ├── EndpointForm.vue           # Shared create/edit form
│       └── HeaderInjectionEditor.vue  # Dynamic key-value editor

tests/
├── unit/
│   ├── api/
│   │   └── endpoints.test.js    # API handler tests
│   ├── stores/
│   │   └── endpoints.test.js    # Pinia store tests
│   └── components/
│       └── endpoints/
│           └── endpoint-form.test.js  # Form validation tests
```

**Structure Decision**: Follows existing project layout from CLAUDE.md. API functions in `api/endpoints/`, Vue components in `src/components/endpoints/`, views in `src/views/`. Same patterns as auth feature (003).

## Complexity Tracking

No violations. Table not applicable.
