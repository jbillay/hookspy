# Tasks: CI/CD Pipeline

**Input**: Design documents from `/specs/010-cicd-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 + 2 — Quality Gates + Auto-Deploy (Priority: P1)

**Goal**: PRs to `main` trigger automated quality checks (lint, format, test). Merges to `main` auto-deploy to Vercel production after quality gates pass.

**Independent Test**: Create a PR with a linting error, verify CI fails. Fix it, verify CI passes. Merge to `main`, verify deployment triggers and app is live.

### Implementation for User Story 1 + 2

- [x] T001 Create GitHub Actions workflow file at .github/workflows/ci-cd.yml — Define workflow name "CI/CD". Set triggers: `push` to `main`, `pull_request` targeting `main`. Define `quality` job on `ubuntu-latest` with `timeout-minutes: 10`. Steps: (1) `actions/checkout@v4`, (2) `actions/setup-node@v4` with `node-version: 20` and `cache: 'npm'`, (3) `npm ci`, (4) `npm run lint`, (5) `npm run format:check`, (6) `npm run test`. Define `deploy` job with `needs: quality`, condition `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`, `timeout-minutes: 10`, on `ubuntu-latest`. Deploy steps: (1) `actions/checkout@v4`, (2) `npm install -g vercel@latest`, (3) `vercel pull --yes --environment=production` with env vars `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` from secrets, (4) `vercel build --prod`, (5) `vercel deploy --prebuilt --prod`.
- [x] T002 Update vercel.json to add functions configuration at vercel.json — Add `"functions"` key configuring the `api/**/*.js` serverless functions with `"maxDuration": 60` to explicitly set the 60-second Vercel function timeout. Keep existing `rewrites` for SPA routing intact.

**Checkpoint**: Workflow file exists. PRs trigger quality checks. Merges to `main` trigger deploy after quality passes.

---

## Phase 2: User Story 3 — Local-CI Parity (Priority: P2)

**Goal**: Developers can run the same checks locally that CI runs, getting identical results.

**Independent Test**: Run `npm run lint`, `npm run format:check`, and `npm run test` locally and verify they match CI output.

### Implementation for User Story 3

- [x] T003 [US3] Verify npm scripts in package.json match CI commands — Confirm that `lint` runs `eslint . --ext .vue,.js`, `format:check` runs `prettier --check .`, and `test` runs `vitest run`. These already exist in package.json. No changes expected — this is a validation task.

**Checkpoint**: Local commands produce identical results to CI. No script changes needed.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Validation and quality checks

- [x] T004 Run lint, format, and build checks — Execute `npm run lint:fix && npm run format && npm run build` to ensure all files pass quality gates.
- [x] T005 Run quickstart.md validation steps — Follow the verification steps in specs/010-cicd-pipeline/quickstart.md. Note: Scenarios 1-4 (PR/deploy workflows) require pushing to GitHub and can only be fully validated after merge. Scenario 5 (local parity) can be validated immediately.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1+US2)**: No dependencies — can start immediately
- **Phase 2 (US3)**: Independent of Phase 1 — can run in parallel
- **Phase 3 (Polish)**: Depends on Phases 1 and 2

### Task Dependencies

- T001 and T002 can run in parallel (different files)
- T003 is independent of T001 and T002
- T004 depends on T001 and T002
- T005 depends on all prior tasks

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003 can run in parallel with T001 and T002

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete T001: Create the workflow file
2. Complete T002: Update vercel.json
3. **STOP and VALIDATE**: Push to GitHub, create a test PR, verify quality gates run
4. Merge to `main`, verify deployment triggers

### Incremental Delivery

1. T001 + T002 → CI/CD pipeline functional → MVP!
2. T003 → Local parity verified
3. T004 + T005 → Polish and validation

---

## Notes

- US1 and US2 are combined into Phase 1 because they share the same workflow file — the `quality` job serves US1 and the `deploy` job serves US2
- US3 requires no code changes — it validates that existing npm scripts match CI commands
- GitHub repository secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) must be configured manually in GitHub Settings > Secrets before the deploy job will work
- Full end-to-end validation (Scenarios 1-4 in quickstart.md) requires pushing to GitHub and creating actual PRs
- Commit after each task
