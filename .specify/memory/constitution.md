<!--
  Sync Impact Report
  ===================
  Version change: N/A (initial) → 1.0.0
  Modified principles: N/A (all new)
  Added sections:
    - Core Principles (5 principles)
    - Technology & Architecture Constraints
    - Development Workflow & Quality Gates
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md — ✅ no update needed
      (Constitution Check section is generic and will be filled per-feature)
    - .specify/templates/spec-template.md — ✅ no update needed
      (Template structure aligns with principles; NEEDS CLARIFICATION markers
       satisfy the Simplicity principle)
    - .specify/templates/tasks-template.md — ✅ no update needed
      (Phase structure, parallel markers, and checkpoint gates are compatible)
    - .specify/templates/checklist-template.md — ✅ no update needed
    - .specify/templates/agent-file-template.md — ✅ no update needed
  Follow-up TODOs: None
-->

# HookSpy Constitution

## Core Principles

### I. Plain JavaScript, No Exceptions

All code MUST be plain JavaScript using ES modules (`import`/`export`).
TypeScript is prohibited. Vue 3 Composition API with `<script setup>` syntax
is the only accepted component authoring pattern. This constraint eliminates
build-tool complexity, keeps the contributor barrier low, and matches the
serverless deployment target (Vercel Functions run plain JS).

### II. Browser-as-Bridge

The browser is the sole relay mechanism between the cloud endpoint and the
local development server. No CLI agent, desktop app, or tunnel daemon is
permitted. Every architectural decision MUST preserve the invariant that an
open browser tab is sufficient to relay webhooks bidirectionally. This means:

- Supabase Realtime MUST be used for push notification of incoming webhooks
  to the browser.
- The browser MUST issue `fetch` requests to `localhost` to forward payloads.
- The local development server MUST have CORS enabled; HookSpy MUST NOT
  attempt workarounds that bypass browser security policies.

### III. Full HTTP Fidelity

Headers and bodies MUST be forwarded exactly as received in both directions
(external system to local server and local server response back to external
system). No payload transformation, normalization, or filtering is permitted.
Custom header injection is additive only and MUST NOT overwrite original
headers. This guarantees that HookSpy behaves as a transparent proxy and
webhook providers see authentic responses.

### IV. Meaningful Testing

Tests MUST cover composables, Pinia stores, utility functions, and component
behavior using Vitest and @vue/test-utils. Tests MUST NOT assert on PrimeVue
component internals or Tailwind CSS class names. Test coverage MUST focus on
relay logic correctness and data flow rather than UI pixel accuracy.
Integration tests for serverless functions SHOULD validate HTTP status codes,
auth enforcement, and CORS headers.

### V. Simplicity & Minimal Scope

Every feature and abstraction MUST justify its existence against the project's
single purpose: relaying webhooks to localhost. YAGNI applies strictly.
Serverless functions MUST use polling (not WebSockets or long-lived
connections) to stay within Vercel's 60-second function timeout. Per-endpoint
configuration (timeout, header injection) is the maximum allowed
customization surface. New configuration dimensions require explicit
justification in the feature spec.

## Technology & Architecture Constraints

- **Frontend**: Vue 3 + Vite + PrimeVue 4 (Aura theme) + Tailwind CSS
- **Backend**: Vercel Serverless Functions (JavaScript only)
- **Database**: Supabase (PostgreSQL + Realtime + Auth)
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions
- **State management**: Pinia for global state; composables for reusable
  logic; `ref`/`reactive` for component-local state
- **Log retention**: 24 hours, enforced by Supabase pg_cron
- **Timeout ceiling**: 55 seconds per request (5-second margin within
  Vercel's 60-second limit)
- **Auth**: JWT via Supabase Auth; all API endpoints MUST validate the
  `Authorization` header; service role key MUST never be exposed to the client
- **Environment variables**: Frontend vars prefixed with `VITE_`; server-side
  secrets accessed only in `api/` functions

## Development Workflow & Quality Gates

- **Linting**: ESLint MUST pass with zero errors before merge.
- **Formatting**: Prettier MUST pass (`npm run format:check`) before merge.
- **Tests**: `npm run test` MUST pass before merge.
- **CI pipeline**: GitHub Actions runs lint, format check, and tests on every
  push. Deployment to Vercel occurs only on `main` when all checks pass.
- **Naming conventions**:
  - Files: kebab-case (JS) or PascalCase (Vue components)
  - Variables/functions: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Database columns: snake_case
  - API routes: kebab-case paths
- **Commit discipline**: Each commit SHOULD represent a single logical change.
  Commit messages MUST be descriptive and follow conventional format when
  possible.

## Governance

This constitution is the authoritative source of project constraints and
principles. All pull requests and code reviews MUST verify compliance with
these principles. Deviations require explicit justification documented in the
PR description and approval from a project maintainer.

### Amendment Procedure

1. Propose the change as a pull request modifying this file.
2. Document the rationale and impact on existing code.
3. Update the version number following semantic versioning:
   - **MAJOR**: Principle removal or backward-incompatible redefinition.
   - **MINOR**: New principle or materially expanded guidance.
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements.
4. Update `LAST_AMENDED_DATE` to the amendment date.
5. Run the consistency propagation checklist (templates, README, CLAUDE.md)
   and document any required follow-up changes.

### Compliance Review

- The Constitution Check section in `plan-template.md` MUST be evaluated
  against these principles at the start of every feature planning cycle.
- Complexity violations MUST be logged in the plan's Complexity Tracking
  table with justification.

**Version**: 1.0.0 | **Ratified**: 2026-02-09 | **Last Amended**: 2026-02-09
