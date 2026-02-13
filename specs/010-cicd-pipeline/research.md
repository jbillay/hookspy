# Research: CI/CD Pipeline

**Feature**: 010-cicd-pipeline | **Date**: 2026-02-12

## Decision 1: GitHub Actions Workflow Structure

**Decision**: Two-job workflow — `quality` (lint, format, test) and `deploy` (Vercel production)

**Rationale**: Separating quality gates from deployment allows PRs to run only quality checks (no deploy), while pushes to `main` run both. The `deploy` job uses `needs: quality` to enforce the gate. This is the standard GitHub Actions pattern for CI/CD.

**Alternatives considered**:

- Single job with conditional deployment step — less clear separation of concerns, harder to see which stage failed
- Three separate workflows (lint, test, deploy) — overcomplicated for this project size; harder to enforce ordering

## Decision 2: Vercel Deployment Method

**Decision**: Use Vercel CLI (`vercel --prod`) with `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub repository secrets

**Rationale**: The Vercel CLI is the most direct and well-documented approach. It supports `--prod` flag for production deploys, works in CI environments with environment variables, and doesn't require the Vercel GitHub App (which would create duplicate deployments).

**Alternatives considered**:

- Vercel GitHub Integration (automatic deploys) — would create duplicate deployments alongside our GitHub Actions workflow; less control over deployment conditions
- `amondnet/vercel-action` third-party action — adds a dependency on a community-maintained action; Vercel CLI is first-party and more reliable

## Decision 3: Node.js Caching Strategy

**Decision**: Use `actions/setup-node` with built-in npm cache (`cache: 'npm'`)

**Rationale**: The `actions/setup-node@v4` action has built-in npm caching support that caches `~/.npm` based on `package-lock.json` hash. This is simpler than manual `actions/cache` configuration and achieves the same result.

**Alternatives considered**:

- Manual `actions/cache` for `node_modules` — more verbose, harder to maintain, and caching `node_modules` directly can cause issues with platform-specific binaries
- No caching — significantly slower CI runs (npm install from scratch each time)

## Decision 4: Workflow Triggers

**Decision**: Trigger on `push` to `main` and `pull_request` targeting `main`

**Rationale**: This covers the two primary scenarios: PRs get quality feedback before merge, and pushes to `main` (merges) trigger deploy. Feature branches only trigger CI when a PR is opened.

**Alternatives considered**:

- Trigger on all branches — unnecessary CI runs on feature branches without PRs; wastes GitHub Actions minutes
- Add `workflow_dispatch` for manual triggers — not needed for MVP; can be added later if desired

## Decision 5: Vercel Build Configuration

**Decision**: Let Vercel CLI handle the build (`vercel build` + `vercel deploy --prebuilt`) rather than building in GitHub Actions

**Rationale**: Using `vercel build` + `vercel deploy --prebuilt` runs the build within Vercel's build system, ensuring environment variables configured in the Vercel dashboard (like `VITE_SUPABASE_URL`) are available at build time. Building in GitHub Actions would require duplicating all Vercel environment variables as GitHub secrets.

**Alternatives considered**:

- Build in GitHub Actions, deploy pre-built assets — requires all `VITE_*` env vars as GitHub secrets, creating duplication; harder to manage environment-specific config
- Use `vercel --prod` directly (single command) — simpler but doesn't support `--prebuilt` optimization; still works well for our project size

## Decision 6: Workflow Timeout

**Decision**: 10-minute timeout for the entire workflow (`timeout-minutes: 10`)

**Rationale**: The quality job (npm ci + lint + format + test) should complete in under 3 minutes. The deploy job adds another 2-3 minutes. A 10-minute timeout provides generous headroom while still preventing runaway builds. Set at the job level for both jobs.

**Alternatives considered**:

- 5-minute timeout — too tight; npm ci on a cold cache could be slow
- No timeout (default 360 minutes) — wastes GitHub Actions minutes if a build hangs
