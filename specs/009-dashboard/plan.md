# Implementation Plan: Dashboard

**Branch**: `009-dashboard` | **Date**: 2026-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-dashboard/spec.md`

## Summary

Build the authenticated dashboard view with summary statistics (endpoint counts, 24h request count), an endpoint list with quick actions (copy URL, toggle active, navigate), and a real-time activity feed showing the 10 most recent webhook events. No new API endpoints or database changes — all data is derived from existing infrastructure.

## Technical Context

**Language/Version**: JavaScript (ES modules), Vue 3 Composition API
**Primary Dependencies**: PrimeVue 4 (Card, Tag, Button, ToggleSwitch), Tailwind CSS 3, Pinia
**Storage**: Supabase PostgreSQL (existing tables, no changes)
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Web (Vercel-hosted SPA)
**Project Type**: Web application (Vue SPA + Vercel serverless)
**Performance Goals**: Dashboard loads within 2 seconds; activity feed updates within 2 seconds of new events
**Constraints**: No new API endpoints; reuse existing stores and APIs
**Scale/Scope**: Single view with 3 sections (stats, endpoints, activity feed)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                          |
| ----------------------------- | ------ | -------------------------------------------------------------- |
| I. Plain JavaScript           | PASS   | All code is plain JS with Vue 3 `<script setup>`               |
| II. Browser-as-Bridge         | PASS   | Dashboard reads data; relay is handled by existing RelayWorker |
| III. Full HTTP Fidelity       | PASS   | Dashboard is read-only; no payload transformation              |
| IV. Meaningful Testing        | PASS   | Tests cover composable logic and component behavior            |
| V. Simplicity & Minimal Scope | PASS   | No new APIs, no new DB tables; reuses existing infrastructure  |

**Post-design re-check**: All 5 principles still PASS. The dashboard composable adds only the minimum state needed (recent logs + 24h count). No new abstractions or API surface.

## Project Structure

### Documentation (this feature)

```text
specs/009-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── dashboard-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── composables/
│   └── use-dashboard.js         # NEW: Dashboard composable (stats + activity feed)
├── components/
│   └── dashboard/
│       ├── StatCard.vue          # NEW: Summary stat card (count + label)
│       ├── DashboardEndpointCard.vue  # NEW: Compact endpoint card with quick actions
│       └── ActivityFeed.vue      # NEW: Recent activity feed with realtime
├── views/
│   └── DashboardView.vue        # REWRITE: Full dashboard layout
tests/
└── unit/
    ├── composables/
    │   └── use-dashboard.test.js # NEW: Dashboard composable tests
    └── components/
        └── ActivityFeed.test.js  # NEW: Activity feed component tests
```

**Structure Decision**: All new code lives within existing project structure. One new composable, three new components, one rewritten view. No new API endpoints or database changes.
