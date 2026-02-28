# Implementation Plan: WebSocket Polling Fallback

**Branch**: `011-ws-polling-fallback` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-ws-polling-fallback/spec.md`

## Summary

Add an adaptive transport layer that auto-detects WebSocket (Supabase Realtime) failures and falls back to HTTP polling. A centralized composable (`use-realtime-transport.js`) replaces direct channel management in all three stores (relay, logs, dashboard). A new serverless polling endpoint (`api/poll/index.js`) returns webhook_log changes since a given timestamp. A database migration adds an `updated_at` column to `webhook_logs` for efficient change detection. The UI shows a transport mode indicator (Connecting/Live/Polling) on the relay status component.

## Technical Context

**Language/Version**: JavaScript (ES modules), Vue 3 Composition API
**Primary Dependencies**: @supabase/supabase-js ^2.95.3, Vue 3, Pinia 3, PrimeVue 4
**Storage**: Supabase PostgreSQL (webhook_logs table) — requires `updated_at` column addition
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Browser (SPA) + Vercel Serverless Functions
**Project Type**: Web application (frontend SPA + serverless API)
**Performance Goals**: Polling fallback delivers events within 4 seconds of arrival (2s interval + processing)
**Constraints**: Vercel 60s function timeout; polling endpoint must respond in <500ms; 2-second poll interval
**Scale/Scope**: Single new API endpoint, 1 new composable, 3 store refactors, 1 component update, 1 DB migration

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | Notes                                                                                                                                                                                                                                            |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Plain JavaScript, No Exceptions | PASS   | All new code is plain JS with ES modules. No TypeScript.                                                                                                                                                                                         |
| II. Browser-as-Bridge              | PASS   | The browser remains the sole relay mechanism. Polling fallback runs in the browser, fetching from the API instead of receiving via WebSocket. The relay still uses `fetch` to localhost.                                                         |
| III. Full HTTP Fidelity            | PASS   | No change to payload forwarding. Headers and bodies are still forwarded exactly as received.                                                                                                                                                     |
| IV. Meaningful Testing             | PASS   | Tests will cover the transport composable (mode switching, failure detection, deduplication) and the polling API endpoint (auth, ownership validation, query correctness).                                                                       |
| V. Simplicity & Minimal Scope      | PASS   | The transport composable is a justified abstraction — it replaces three independent channel management implementations with one unified interface. The polling endpoint is a single new function. No unnecessary configuration surface is added. |

**Constitution Check: PASSED** — No violations. No complexity tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/011-ws-polling-fallback/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── poll-api.md      # Polling endpoint contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
api/
├── poll/
│   └── index.js                          # NEW — Polling API endpoint
└── _lib/
    ├── auth.js                           # EXISTING — JWT verification
    ├── cors.js                           # EXISTING — CORS helper
    └── supabase.js                       # EXISTING — Service-role client

src/
├── composables/
│   ├── use-realtime-transport.js         # NEW — Centralized transport manager
│   ├── use-supabase.js                   # EXISTING — Supabase client singleton
│   └── use-dashboard.js                  # MODIFY — Use transport composable
├── stores/
│   ├── relay.js                          # MODIFY — Use transport composable
│   └── logs.js                           # MODIFY — Use transport composable
└── components/
    └── relay/
        ├── RelayStatus.vue               # MODIFY — Add transport mode indicator
        └── RelayWorker.vue               # EXISTING — No changes needed

supabase/
└── migrations/
    └── 2026XXXXXXXXXX_add_updated_at.sql # NEW — Add updated_at column + trigger

tests/
└── unit/
    ├── composables/
    │   └── use-realtime-transport.test.js # NEW — Transport composable tests
    └── api/
        └── poll.test.js                   # NEW — Polling endpoint tests
```

**Structure Decision**: Follows existing project layout conventions. One new composable, one new API endpoint, one new migration. Modified files integrate via the transport composable's `subscribe()`/`unsubscribe()` interface.

## Complexity Tracking

> No violations — table not needed.
