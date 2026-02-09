# HookSpy Constitution

## Core Principles

### I. Browser-First Relay

All webhook forwarding MUST happen through the browser. There is no CLI agent, no
WebSocket tunnel, no server-side forwarding. The user's browser is the relay bridge
between the HookSpy serverless function and the local development server. The SPA
must be open for relay to function.

### II. Zero Transformation

Headers and bodies MUST be forwarded without any alteration in both directions
(webhook sender to local server, and local server response back to sender). The only
exception is additive custom header injection configured by the user. HookSpy is a
transparent proxy — it never modifies, filters, or reinterprets payloads.

### III. JavaScript Only

All code MUST be written in plain JavaScript (ES modules). No TypeScript anywhere in
the codebase — not in the frontend, not in serverless functions, not in tests, not in
configuration. This is non-negotiable.

### IV. Simplicity Over Cleverness

Start simple, follow YAGNI. Do not over-engineer, do not add abstractions for
hypothetical future needs. Prefer three similar lines of code over a premature
abstraction. Only add complexity when the current task demands it.

### V. Real-Time by Default

The UI MUST reflect state changes in real time. New webhooks, status changes, and
responses must appear in the dashboard without manual refresh. Supabase Realtime
subscriptions are the mechanism — no polling on the frontend.

### VI. User Isolation

Every user MUST only see their own endpoints and logs. Row Level Security (RLS) in
Supabase enforces this at the database level. Serverless functions use service role
keys but always filter by authenticated user ID.

### VII. Quality Gates

All code MUST pass linting (ESLint), formatting (Prettier), and unit tests (Vitest)
before merging to main. The CI/CD pipeline enforces this — no deployment occurs
unless all checks pass.

## Technology Constraints

- **Frontend**: Vue 3 Composition API, `<script setup>` syntax, Pinia stores
- **UI**: PrimeVue 4 (Aura theme) + Tailwind CSS — no other UI libraries
- **Backend**: Vercel Serverless Functions only — no Express, no custom server
- **Database**: Supabase PostgreSQL — no other databases or ORMs
- **Auth**: Supabase Auth — no custom auth implementation
- **Build**: Vite — no Webpack, no other bundlers
- **Testing**: Vitest + @vue/test-utils — no Jest, no Cypress for V1

## Security Principles

- Service role keys are NEVER exposed to the client
- All API endpoints validate JWT auth before processing
- Environment variables for secrets, never hardcoded
- CORS headers are explicit, not wildcard in production
- Webhook security (signatures, tokens) is the responsibility of the user's local
  server, not HookSpy

## Development Workflow

- Feature branches from `main`
- Pull requests require CI checks to pass
- Spec-driven development via SpecKit: specify, plan, tasks, implement
- Constitution supersedes all other practices

**Version**: 1.0.0 | **Ratified**: 2026-02-09 | **Last Amended**: 2026-02-09
