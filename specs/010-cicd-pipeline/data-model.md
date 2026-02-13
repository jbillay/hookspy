# Data Model: CI/CD Pipeline

**Feature**: 010-cicd-pipeline | **Date**: 2026-02-12

## Overview

This feature does not introduce any new data entities, database tables, or application state. It is purely infrastructure configuration.

## Entities

No new entities. The CI/CD pipeline operates on:

- **Workflow Configuration** (`.github/workflows/ci-cd.yml`): YAML file defining jobs, steps, triggers, and secrets references
- **Repository Secrets**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — stored in GitHub repository settings (not in source code)
- **Vercel Environment Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — configured in Vercel project settings

## Database Changes

None. No migrations required.

## State Transitions

The pipeline has implicit state transitions managed by GitHub Actions:

```
Push/PR → Quality Job (pending → running → pass/fail)
                                    ↓ (if pass + push to main)
                              Deploy Job (pending → running → pass/fail)
```

These states are managed by GitHub Actions infrastructure and do not require application code.
