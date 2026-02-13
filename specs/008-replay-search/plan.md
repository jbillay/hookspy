# Implementation Plan: Replay & Search

**Branch**: `008-replay-search` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-replay-search/spec.md`

## Summary

Add webhook replay functionality and log search/filtering to HookSpy. Replay creates a new webhook_log record from an existing log's request data, which the browser relay then forwards identically to an original webhook. Search and filtering extend the existing GET /api/logs endpoint with method, status, date range, and text search parameters, synced to the URL for bookmarkability. A new LogFilters component provides the UI controls.

## Technical Context

**Language/Version**: JavaScript (ES modules), Vue 3 Composition API
**Primary Dependencies**: Vue 3, PrimeVue 4 (Aura), Pinia, Supabase JS client, Tailwind CSS
**Storage**: Supabase PostgreSQL (existing webhook_logs table + new `replayed_from` column)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Web (Vercel hosting)
**Project Type**: Web application (Vue SPA + Vercel serverless functions)
**Performance Goals**: Search results < 500ms for datasets under 1000 logs
**Constraints**: 24-hour log retention, Vercel 60s function timeout, browser-based relay only
**Scale/Scope**: < 1000 logs per user (24h retention), single-user relay sessions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | Notes                                                                                                                          |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| I. Plain JavaScript, No Exceptions | PASS   | All new code is plain JS with ES modules and Vue 3 `<script setup>`                                                            |
| II. Browser-as-Bridge              | PASS   | Replay creates a `pending` log record; the existing browser relay forwards it. No server-side forwarding or CLI agent.         |
| III. Full HTTP Fidelity            | PASS   | Replay copies request_method, request_url, request_headers, request_body exactly. No transformation.                           |
| IV. Meaningful Testing             | PASS   | Tests cover store logic, API endpoint behavior, and component interactions. No PrimeVue internal or Tailwind class assertions. |
| V. Simplicity & Minimal Scope      | PASS   | Replay reuses existing relay mechanism. Search uses simple ILIKE queries. No new abstractions or config dimensions.            |

## Project Structure

### Documentation (this feature)

```text
specs/008-replay-search/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── replay-search-api.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
api/
├── logs/
│   ├── index.js             # Extended: add method/status/date/search filters
│   ├── [id].js              # Existing: single log detail
│   └── [id]/
│       ├── response.js      # Existing: relay response submission
│       └── replay.js        # NEW: POST replay endpoint
└── _lib/                    # Shared helpers (existing)

supabase/
└── migrations/
    └── 20260212000001_add_replayed_from.sql  # NEW: migration

src/
├── stores/
│   └── logs.js              # Extended: filter state + replay action
├── composables/
│   └── use-logs.js          # Existing thin wrapper (no changes needed)
├── components/
│   └── logs/
│       ├── LogList.vue      # Extended: filter panel + URL sync + replay button
│       ├── LogDetail.vue    # Extended: replay button + replay badge
│       ├── LogFilters.vue   # NEW: filter panel component
│       └── PayloadViewer.vue # Existing (no changes)
├── views/
│   ├── LogsView.vue         # Existing (no changes)
│   └── EndpointDetailView.vue # Existing (no changes)
└── router/
    └── index.js             # Existing (no changes)

tests/
└── unit/
    ├── stores/
    │   └── logs.test.js     # Extended: test new filter/replay actions
    ├── composables/
    │   └── use-logs.test.js # Existing (no changes needed)
    └── components/
        └── LogFilters.test.js  # NEW: test filter component
```

**Structure Decision**: Follows existing project structure. New files are minimal: 1 API endpoint, 1 migration, 1 component, 1 test file. Most work extends existing files.
