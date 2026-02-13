# Quickstart: CI/CD Pipeline

**Feature**: 010-cicd-pipeline | **Date**: 2026-02-12

## Prerequisites

- GitHub repository with push access
- Vercel account with project linked to the repository
- GitHub repository secrets configured: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- Vercel project environment variables configured: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Verification Scenarios

### Scenario 1: Quality Pipeline on PR

1. Create a feature branch and make a change
2. Push the branch and open a PR targeting `main`
3. Verify: GitHub Actions workflow triggers automatically
4. Verify: Quality job runs lint, format check, and tests
5. Verify: PR shows green check when all pass

### Scenario 2: Quality Pipeline Failure

1. On a feature branch, introduce a linting error (e.g., unused variable)
2. Push and open a PR targeting `main`
3. Verify: Quality job fails at the lint step
4. Verify: PR shows red check with error details visible in the Actions log

### Scenario 3: Deploy on Merge to Main

1. Merge a PR with passing quality checks to `main`
2. Verify: Quality job runs again on the push to `main`
3. Verify: Deploy job triggers after quality job passes
4. Verify: Application is live at the Vercel production URL

### Scenario 4: Deploy Blocked by Quality Failure

1. If quality gates fail on a push to `main` (e.g., force merge)
2. Verify: Deploy job does NOT run
3. Verify: Pipeline shows failed status with the specific failing step

### Scenario 5: Local-CI Parity

1. Run `npm run lint` locally — verify same results as CI
2. Run `npm run format:check` locally — verify same results as CI
3. Run `npm run test` locally — verify same results as CI

### Scenario 6: Caching Effectiveness

1. Push two consecutive commits to a PR
2. Verify: Second run completes faster due to npm cache hit
3. Verify: Cache restore message visible in Actions log

### Scenario 7: Timeout Protection

1. Verify: Workflow has `timeout-minutes` set on both jobs
2. Verify: If a step hangs, the job is terminated within the timeout period
