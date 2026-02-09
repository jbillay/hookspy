# Implementation Plan: Project Scaffolding

**Branch**: `001-project-scaffolding` | **Date**: 2026-02-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-project-scaffolding/spec.md`

## Summary

Set up the complete HookSpy project foundation: Vue 3 + Vite frontend with
PrimeVue 4 and Tailwind CSS, Vercel serverless function structure, Supabase
client composable, quality tooling (ESLint, Prettier, Vitest), and deployment
configuration. After this feature, a developer can clone, install, develop,
lint, test, build, and deploy with zero additional setup.

## Technical Context

**Language/Version**: JavaScript (ES2022+), Node.js 20+
**Primary Dependencies**: Vue 3, Vite 5, Vue Router 4, Pinia, PrimeVue 4
(Aura theme), PrimeIcons, Tailwind CSS 3, @supabase/supabase-js
**Storage**: Supabase (PostgreSQL + Realtime + Auth) — client library
installed; no schema in this feature
**Testing**: Vitest, @vue/test-utils, jsdom
**Target Platform**: Web browser (SPA) + Vercel serverless (Node.js 20)
**Project Type**: Web application (frontend SPA + serverless API)
**Performance Goals**: Dev server cold start <5s; production build <500KB gzip
**Constraints**: No TypeScript; Vercel 60s function timeout; VITE\_ prefix for
frontend env vars
**Scale/Scope**: Single developer setup; scaffolding only (no business logic)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | Notes                                                                                                                               |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| I. Plain JavaScript, No Exceptions | PASS   | All code is JS with ES modules; no TypeScript configured                                                                            |
| II. Browser-as-Bridge              | PASS   | Not directly applicable to scaffolding; no relay logic in this feature. Supabase client composable prepared for future Realtime use |
| III. Full HTTP Fidelity            | PASS   | Not applicable to scaffolding; placeholder function passes through without transformation                                           |
| IV. Meaningful Testing             | PASS   | Vitest + @vue/test-utils configured; sample test covers a composable (not PrimeVue internals)                                       |
| V. Simplicity & Minimal Scope      | PASS   | Only tooling and configuration; no business logic; no unnecessary abstractions                                                      |

All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-scaffolding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal for scaffolding)
├── quickstart.md        # Phase 1 output
└── contracts/
    └── api-placeholder.md  # Placeholder endpoint contract
```

### Source Code (repository root)

```text
api/
├── hook/
│   └── [slug].js            # Placeholder webhook receiver (FR-013)
└── _lib/
    └── supabase.js          # Server-side Supabase client stub

src/
├── assets/
│   └── main.css             # Tailwind @layer imports
├── components/
│   └── layout/
│       └── AppLayout.vue    # Base layout wrapper
├── composables/
│   └── useSupabase.js       # Supabase client composable (FR-011)
├── router/
│   └── index.js             # Vue Router configuration
├── stores/                  # Pinia store directory (empty, ready)
├── views/
│   └── HomeView.vue         # Placeholder home page
├── App.vue                  # Root component with RouterView + Toast (FR-012)
└── main.js                  # App entry point

tests/
├── unit/
│   └── composables/
│       └── useSupabase.test.js  # Sample test (FR-006)
└── setup.js                 # Vitest global setup

.env.example                 # Environment variable documentation (FR-008)
.eslintrc.cjs                # ESLint configuration (FR-004)
.gitignore                   # VCS ignore rules (FR-009)
.prettierrc                  # Prettier configuration (FR-005)
package.json                 # Project manifest with all scripts (FR-010)
tailwind.config.js           # Tailwind CSS configuration (FR-002)
vercel.json                  # Vercel deployment config (FR-007)
vite.config.js               # Vite build configuration
```

**Structure Decision**: Web application with a flat structure — `src/` for the
Vue SPA frontend, `api/` for Vercel serverless functions (colocated at repo
root per Vercel convention), and `tests/` for test files. This matches the
project structure defined in CLAUDE.md.

## Complexity Tracking

> No constitution violations. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
