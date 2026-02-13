# Implementation Plan: CI/CD Pipeline

**Branch**: `010-cicd-pipeline` | **Date**: 2026-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-cicd-pipeline/spec.md`

## Summary

Add a GitHub Actions CI/CD pipeline with two jobs: a `quality` job that runs lint, format check, and unit tests on every push and PR to `main`, and a `deploy` job that deploys to Vercel production only on pushes to `main` after the quality job passes. No new application code — only a workflow YAML file and minor vercel.json updates.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 20
**Primary Dependencies**: GitHub Actions, Vercel CLI, existing npm scripts
**Storage**: N/A (no database changes)
**Testing**: Vitest (existing — executed by pipeline, no new tests)
**Target Platform**: GitHub Actions (ubuntu-latest) → Vercel (production hosting)
**Project Type**: Web application (Vue SPA + Vercel serverless)
**Performance Goals**: Quality pipeline completes in under 3 minutes; deployment live within 5 minutes
**Constraints**: 10-minute max workflow timeout; secrets in GitHub repo settings only
**Scale/Scope**: Single workflow file with 2 jobs; minor vercel.json update

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                      |
| ----------------------------- | ------ | ---------------------------------------------------------- |
| I. Plain JavaScript           | PASS   | Workflow YAML only; no application code changes            |
| II. Browser-as-Bridge         | PASS   | CI/CD is infrastructure; no relay architecture changes     |
| III. Full HTTP Fidelity       | PASS   | No payload handling changes                                |
| IV. Meaningful Testing        | PASS   | Pipeline runs existing tests; no test changes needed       |
| V. Simplicity & Minimal Scope | PASS   | Single YAML file; uses existing npm scripts and Vercel CLI |

**Post-design re-check**: All 5 principles still PASS. The pipeline adds zero application complexity — it orchestrates existing scripts and deploys via Vercel CLI.

## Project Structure

### Documentation (this feature)

```text
specs/010-cicd-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── pipeline-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci-cd.yml            # NEW: GitHub Actions workflow (quality + deploy)

vercel.json                  # UPDATE: Add functions config for serverless
```

**Structure Decision**: This feature adds only infrastructure configuration files. No application source code is created or modified. The `.github/workflows/` directory follows GitHub Actions conventions.
