# Implementation Plan: Browser Relay Engine

**Branch**: `006-browser-relay` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-browser-relay/spec.md`

## Summary

Implement the browser-based webhook relay engine — the core mechanism that makes HookSpy work. When the dashboard is open, the browser subscribes to Supabase Realtime for new webhook logs, claims pending webhooks via optimistic status update, forwards them to the user's local development server via `fetch()`, and submits the local server's response back through the existing response API. Includes a status indicator in the header and multi-tab deduplication.

## Technical Context

**Language/Version**: JavaScript (ES modules, no TypeScript)
**Primary Dependencies**: Vue 3 (Composition API), Pinia, Supabase JS Client (Realtime), Fetch API
**Storage**: Supabase PostgreSQL (existing `webhook_logs` and `endpoints` tables, no schema changes)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (Vue 3 SPA + Vercel serverless)
**Performance Goals**: Webhook forwarding within 1 second of arrival; Realtime reconnection within 5 seconds
**Constraints**: Browser fetch API forbidden headers cannot be set; local server must have CORS enabled; SPA must be open for relay to work
**Scale/Scope**: Single user with multiple endpoints; parallel forwarding of simultaneous webhooks

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | Notes                                                                                                                                     |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| I. Plain JavaScript, No Exceptions | PASS   | All code is plain JS with `<script setup>`                                                                                                |
| II. Browser-as-Bridge              | PASS   | Core feature: browser forwards via fetch to localhost, Supabase Realtime for push notifications                                           |
| III. Full HTTP Fidelity            | PASS   | Headers and body forwarded as-is; browser-restricted headers are a platform limitation, not a design choice; custom headers additive only |
| IV. Meaningful Testing             | PASS   | Tests cover relay store logic, composable behavior, forwarding correctness; no PrimeVue internals or Tailwind class assertions            |
| V. Simplicity & Minimal Scope      | PASS   | No new abstractions beyond required store/composable/component pattern; single Realtime channel; no queuing or complex coordination       |

**Post-Phase 1 re-check**: The design adds one new RLS policy (UPDATE on webhook_logs for status claim). This is the minimum needed for multi-tab deduplication. No new tables, no new API endpoints, no new config dimensions.

## Project Structure

### Documentation (this feature)

```text
specs/006-browser-relay/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── relay-api.md     # Consumed API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── stores/
│   └── relay.js                    # NEW: Pinia store for relay state and logic
├── composables/
│   └── use-relay.js                # NEW: Thin wrapper over relay store
├── components/
│   ├── relay/
│   │   ├── RelayWorker.vue         # NEW: Invisible component, manages subscription
│   │   └── RelayStatus.vue         # NEW: Status indicator (green/red/amber dot)
│   └── layout/
│       ├── AppLayout.vue           # MODIFIED: Mount RelayWorker when authenticated
│       └── AppHeader.vue           # MODIFIED: Add RelayStatus indicator

supabase/
└── migrations/
    └── XXXXXX_relay_rls_policy.sql # NEW: UPDATE policy for webhook_logs

tests/
└── unit/
    ├── stores/
    │   └── relay.test.js           # NEW: Relay store tests
    └── composables/
        └── use-relay.test.js       # NEW: Relay composable tests
```

**Structure Decision**: Follows existing project structure. New files slot into established directories (`stores/`, `composables/`, `components/relay/`). Two existing layout components are modified. One new Supabase migration for the RLS UPDATE policy.

## Complexity Tracking

No constitution violations. No complexity tracking entries needed.
