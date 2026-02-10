# Implementation Plan: Webhook Receiver

**Branch**: `005-webhook-receiver` | **Date**: 2026-02-10 | **Spec**: [spec.md](../../.specify/specs/005-webhook-receiver/spec.md)
**Input**: Feature specification from `.specify/specs/005-webhook-receiver/spec.md`

## Summary

Implement the core webhook relay mechanism: a serverless function at `/api/hook/[slug]` that receives external webhook requests, stores them in `webhook_logs`, polls for browser-submitted responses, and returns them to the caller. Also implement the response submission endpoint at `/api/logs/[id]/response` for the browser relay to post local server responses back.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js (Vercel runtime)
**Primary Dependencies**: @supabase/supabase-js ^2.95.3, existing api/\_lib helpers (supabase.js, auth.js, cors.js)
**Storage**: Supabase PostgreSQL — `endpoints` and `webhook_logs` tables (already created via migrations)
**Testing**: Vitest ^4.0.18 with mocked Supabase client
**Target Platform**: Vercel Serverless Functions
**Project Type**: Web application (Vue 3 SPA + Vercel API)
**Performance Goals**: 404 responses within 100ms; polling loop at 500ms intervals; max 55s timeout
**Constraints**: Vercel 60s function timeout (55s max configurable); 1MB max request body; 60 req/min per endpoint rate limit
**Scale/Scope**: Single-user dev tool; low concurrency expected per endpoint

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                                                                                   |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| I. Plain JavaScript           | PASS   | All code is plain JS with ES modules                                                                                    |
| II. Browser-as-Bridge         | PASS   | Webhook receiver stores requests; browser relay submits responses via `/api/logs/:id/response`; no CLI agent or tunnel  |
| III. Full HTTP Fidelity       | PASS   | FR-004 stores all headers, body, method, URL without transformation; FR-006 returns exact response data                 |
| IV. Meaningful Testing        | PASS   | Tests will cover HTTP status codes, auth enforcement, CORS, polling logic, and timeout behavior                         |
| V. Simplicity & Minimal Scope | PASS   | Uses polling (not WebSockets); per-endpoint timeout; no relay-presence tracking; rate limit is simple in-memory counter |

No violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/005-webhook-receiver/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── webhook-receiver.md
│   └── response-submission.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
api/
├── hook/
│   └── [slug].js            # Webhook receiver (replace placeholder)
├── logs/
│   └── [id]/
│       └── response.js      # Response submission endpoint (new)
└── _lib/
    ├── supabase.js          # Existing: service role client
    ├── auth.js              # Existing: JWT verification
    └── cors.js              # Existing: CORS headers

tests/
└── unit/
    └── api/
        ├── hook-slug.test.js      # Webhook receiver tests (new)
        └── log-response.test.js   # Response submission tests (new)
```

**Structure Decision**: Follows existing project layout. No new directories needed except `api/logs/[id]/` for the response endpoint. Tests follow the established pattern in `tests/unit/api/`.

## Complexity Tracking

No violations to justify. All implementation follows existing patterns.
