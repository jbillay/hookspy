# Feature Specification: Project Scaffolding

**Feature Branch**: `001-project-scaffolding`
**Created**: 2026-02-09
**Status**: Draft
**Input**: Initial project setup requirements

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Initializes Project (Priority: P1)

A developer clones the repository and runs `npm install` followed by `npm run dev`
to start a fully functional development environment with Vue 3, Tailwind CSS,
PrimeVue, and Vite — all configured and working together.

**Why this priority**: Nothing else can be built without a working project foundation.

**Independent Test**: Run `npm install && npm run dev` on a fresh clone and verify
the development server starts without errors and renders a placeholder page.

**Acceptance Scenarios**:

1. **Given** a fresh clone, **When** I run `npm install`, **Then** all dependencies install without errors
2. **Given** dependencies are installed, **When** I run `npm run dev`, **Then** a Vite dev server starts on port 5173 and renders a Vue 3 app with PrimeVue and Tailwind CSS loaded
3. **Given** the dev server is running, **When** I edit a `.vue` file, **Then** hot module replacement updates the browser instantly

---

### User Story 2 - Developer Runs Quality Checks (Priority: P1)

A developer runs linting, formatting, and tests to ensure code quality before
committing. All three commands work out of the box.

**Why this priority**: Quality tooling is foundational and required by the CI/CD pipeline.

**Independent Test**: Run `npm run lint`, `npm run format:check`, and `npm run test`
and verify all pass on the initial scaffolded code.

**Acceptance Scenarios**:

1. **Given** the scaffolded project, **When** I run `npm run lint`, **Then** ESLint checks all `.js` and `.vue` files with no errors
2. **Given** the scaffolded project, **When** I run `npm run format:check`, **Then** Prettier reports all files are correctly formatted
3. **Given** the scaffolded project, **When** I run `npm run test`, **Then** Vitest runs and a sample test passes
4. **Given** the scaffolded project, **When** I run `npm run build`, **Then** Vite produces a production build without errors

---

### User Story 3 - Developer Deploys to Vercel (Priority: P2)

A developer can deploy the scaffolded project to Vercel and it serves the SPA
correctly, with serverless function routing configured.

**Why this priority**: Deployment configuration should be verified early to avoid
late-stage integration issues.

**Independent Test**: Deploy to Vercel and verify the SPA loads and API routes
return responses.

**Acceptance Scenarios**:

1. **Given** a Vercel project linked to the repo, **When** I deploy, **Then** the SPA is served at the root URL
2. **Given** the deployment, **When** I request `/api/hook/test`, **Then** the serverless function responds (even if with a placeholder)
3. **Given** the deployment, **When** I navigate to a Vue route and refresh, **Then** the SPA loads correctly (Vercel rewrites configured)

---

### Edge Cases

- What happens when Node.js version is below 20? Package.json should specify `engines`
- What happens when PrimeVue theme conflicts with Tailwind? Tailwind preflight must be configured to coexist
- What happens when Vercel rewrites conflict with API routes? `/api/*` must be excluded from SPA rewrites

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Project MUST be initialized with Vue 3, Vite, Vue Router, and Pinia using JavaScript (no TypeScript)
- **FR-002**: Tailwind CSS v3 MUST be installed and configured with base, components, and utilities layers
- **FR-003**: PrimeVue 4 MUST be installed with the Aura theme and PrimeIcons
- **FR-004**: ESLint MUST be configured with `eslint-plugin-vue` (recommended rules) and Prettier integration
- **FR-005**: Prettier MUST be configured with consistent formatting rules (single quotes, no semicolons or project-standard)
- **FR-006**: Vitest MUST be configured with `@vue/test-utils` and a working sample test
- **FR-007**: A `vercel.json` MUST configure SPA rewrites and serverless function routing for `/api/*`
- **FR-008**: The project MUST include a `.env.example` file documenting all required environment variables
- **FR-009**: The project MUST include a `.gitignore` covering `node_modules`, `dist`, `.env`, and IDE files
- **FR-010**: Package.json MUST define scripts: `dev`, `build`, `preview`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:coverage`
- **FR-011**: The Supabase client library (`@supabase/supabase-js`) MUST be installed and a composable (`useSupabase.js`) created
- **FR-012**: An initial App.vue MUST render with a router-view and the PrimeVue Toast component
- **FR-013**: A placeholder serverless function MUST exist at `api/hook/[slug].js` to validate Vercel routing

### Key Entities

- **package.json**: Project metadata, dependencies, and scripts
- **vercel.json**: Deployment configuration and route rewrites
- **vite.config.js**: Build tool configuration
- **tailwind.config.js**: Tailwind CSS configuration with content paths

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm install` completes with zero vulnerabilities of high/critical severity
- **SC-002**: `npm run dev` starts the dev server in under 5 seconds
- **SC-003**: `npm run build` produces a production bundle under 500KB (gzipped)
- **SC-004**: `npm run lint`, `npm run format:check`, and `npm run test` all pass with zero errors
- **SC-005**: Deployment to Vercel succeeds and serves the SPA at the root URL
