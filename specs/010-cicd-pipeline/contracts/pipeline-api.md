# Pipeline Contract: CI/CD Pipeline

**Feature**: 010-cicd-pipeline | **Date**: 2026-02-12

## Overview

This feature has no API contracts in the traditional sense. Instead, it defines the contract between the GitHub Actions workflow and the project's existing npm scripts and Vercel deployment.

## Workflow Contract

### Triggers

| Event          | Branch           | Jobs Executed        |
| -------------- | ---------------- | -------------------- |
| `pull_request` | targeting `main` | `quality` only       |
| `push`         | `main`           | `quality` → `deploy` |

### Quality Job Contract

The quality job depends on these npm scripts existing and returning exit code 0 on success:

| Step    | Command                | Expected Behavior                                              |
| ------- | ---------------------- | -------------------------------------------------------------- |
| Install | `npm ci`               | Install exact versions from `package-lock.json`                |
| Lint    | `npm run lint`         | ESLint checks `.vue` and `.js` files; exits non-zero on errors |
| Format  | `npm run format:check` | Prettier checks all files; exits non-zero on formatting issues |
| Test    | `npm run test`         | Vitest runs all unit tests; exits non-zero on failures         |

### Deploy Job Contract

The deploy job requires these GitHub repository secrets:

| Secret              | Purpose                             |
| ------------------- | ----------------------------------- |
| `VERCEL_TOKEN`      | Authentication token for Vercel CLI |
| `VERCEL_ORG_ID`     | Vercel organization/team identifier |
| `VERCEL_PROJECT_ID` | Vercel project identifier           |

Deploy steps:

| Step        | Command                                      | Expected Behavior                                        |
| ----------- | -------------------------------------------- | -------------------------------------------------------- |
| Pull config | `vercel pull --yes --environment=production` | Fetches project settings and env vars from Vercel        |
| Build       | `vercel build --prod`                        | Builds the production bundle using Vercel's build system |
| Deploy      | `vercel deploy --prebuilt --prod`            | Deploys the pre-built output to production               |

### Existing Script Parity

The pipeline executes the same commands available locally:

| Local Command          | CI Command             | Purpose           |
| ---------------------- | ---------------------- | ----------------- |
| `npm run lint`         | `npm run lint`         | ESLint check      |
| `npm run format:check` | `npm run format:check` | Prettier check    |
| `npm run test`         | `npm run test`         | Vitest unit tests |
