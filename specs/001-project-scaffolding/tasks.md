---
description: 'Task list for project scaffolding implementation'
---

# Tasks: Project Scaffolding

**Input**: Design documents from `/specs/001-project-scaffolding/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No test tasks generated (not explicitly requested in spec). A sample test file is created as part of FR-006 to verify the test runner works.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend SPA**: `src/` at repository root
- **Serverless API**: `api/` at repository root
- **Tests**: `tests/` at repository root
- **Config files**: repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the project with package.json and core directory structure

- [x] T001 Initialize package.json with name `hookspy`, version `0.0.0`, type `module`, and engines `>=20.0.0` at package.json
- [x] T002 Install Vue 3, Vue Router 4, and Pinia as dependencies via `npm install vue vue-router pinia`
- [x] T003 Install Vite 5 and @vitejs/plugin-vue as dev dependencies via `npm install -D vite @vitejs/plugin-vue`
- [x] T004 Create project directory structure: `src/assets/`, `src/components/layout/`, `src/composables/`, `src/router/`, `src/stores/`, `src/views/`, `api/hook/`, `api/_lib/`, `tests/unit/composables/`
- [x] T005 Create index.html at project root with `<div id="app"></div>` and script tag pointing to `/src/main.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration files that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create vite.config.js with @vitejs/plugin-vue plugin and Vitest test configuration (jsdom environment, setup file at tests/setup.js, coverage via @vitest/coverage-v8) at vite.config.js
- [x] T007 [P] Create .gitignore with rules for node_modules/, dist/, .env, .env.local, \*.local, .DS_Store, and IDE files (.vscode/, .idea/) at .gitignore
- [x] T008 [P] Create .env.example documenting VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL, and SUPABASE_SERVICE_ROLE_KEY at .env.example
- [x] T009 Add all npm scripts to package.json: dev (`vite`), build (`vite build`), preview (`vite preview`), lint (`eslint . --ext .vue,.js`), lint:fix (`eslint . --ext .vue,.js --fix`), format (`prettier --write .`), format:check (`prettier --check .`), test (`vitest run`), test:coverage (`vitest run --coverage`) at package.json

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Developer Initializes Project (Priority: P1) MVP

**Goal**: A developer runs `npm install && npm run dev` and gets a working Vue 3 + PrimeVue + Tailwind dev server with HMR

**Independent Test**: Run `npm install && npm run dev` on a fresh clone and verify the dev server starts, renders a placeholder page with PrimeVue and Tailwind styling applied, and HMR works on file edits

### Implementation for User Story 1

- [x] T010 [P] [US1] Install Tailwind CSS 3, PostCSS, and Autoprefixer as dev dependencies via `npm install -D tailwindcss postcss autoprefixer`
- [x] T011 [P] [US1] Install PrimeVue 4, PrimeIcons, and tailwindcss-primeui via `npm install primevue primeicons tailwindcss-primeui`
- [x] T012 [P] [US1] Install @supabase/supabase-js via `npm install @supabase/supabase-js`
- [x] T013 [US1] Create tailwind.config.js with content paths `["./index.html", "./src/**/*.{vue,js}"]` and `corePlugins.preflight: false` for PrimeVue coexistence at tailwind.config.js
- [x] T014 [US1] Create postcss.config.js with tailwindcss and autoprefixer plugins at postcss.config.js
- [x] T015 [US1] Create src/assets/main.css with Tailwind `@tailwind base; @tailwind components; @tailwind utilities;` layer imports at src/assets/main.css
- [x] T016 [US1] Create src/composables/useSupabase.js as a lazy singleton composable that initializes @supabase/supabase-js client using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables at src/composables/useSupabase.js
- [x] T017 [US1] Create src/router/index.js with Vue Router configured for history mode and a single route mapping `/` to HomeView at src/router/index.js
- [x] T018 [US1] Create src/views/HomeView.vue as a placeholder page using PrimeVue Card and Button components with Tailwind layout classes to verify both frameworks load at src/views/HomeView.vue
- [x] T019 [US1] Create src/components/layout/AppLayout.vue as a base layout wrapper with a slot for page content at src/components/layout/AppLayout.vue
- [x] T020 [US1] Create src/App.vue with `<RouterView />` wrapped in AppLayout and PrimeVue `<Toast />` component at src/App.vue
- [x] T021 [US1] Create src/main.js that imports Vue, creates the app, registers Vue Router, Pinia, PrimeVue (Aura preset), PrimeIcons CSS, Tailwind CSS (main.css), and mounts to `#app` at src/main.js
- [x] T022 [US1] Run `npm run dev` and verify the Vite dev server starts on port 5173, the placeholder page renders with PrimeVue components and Tailwind styling applied

**Checkpoint**: User Story 1 complete — `npm install && npm run dev` works end to end

---

## Phase 4: User Story 2 — Developer Runs Quality Checks (Priority: P1)

**Goal**: `npm run lint`, `npm run format:check`, `npm run test`, and `npm run build` all pass with zero errors on the scaffolded code

**Independent Test**: Run all four commands sequentially and verify each exits with code 0

### Implementation for User Story 2

- [x] T023 [P] [US2] Install ESLint, eslint-plugin-vue, and eslint-config-prettier as dev dependencies via `npm install -D eslint eslint-plugin-vue eslint-config-prettier`
- [x] T024 [P] [US2] Install Prettier as a dev dependency via `npm install -D prettier`
- [x] T025 [P] [US2] Install Vitest, @vue/test-utils, jsdom, and @vitest/coverage-v8 as dev dependencies via `npm install -D vitest @vue/test-utils jsdom @vitest/coverage-v8`
- [x] T026 [US2] Create .eslintrc.cjs with `plugin:vue/vue3-recommended` and `eslint-config-prettier` extends, parser options for ES2022 and sourceType module at .eslintrc.cjs
- [x] T027 [US2] Create .prettierrc with project formatting rules (singleQuote, semi, trailingComma, printWidth, tabWidth) at .prettierrc
- [x] T028 [US2] Create tests/setup.js as the Vitest global setup file (can be minimal/empty initially) at tests/setup.js
- [x] T029 [US2] Create tests/unit/composables/useSupabase.test.js with a sample test that imports useSupabase and verifies it returns a client object (mock env vars) at tests/unit/composables/useSupabase.test.js
- [x] T030 [US2] Run `npm run lint` and fix any lint errors in scaffolded files until it passes with zero errors
- [x] T031 [US2] Run `npm run format:check` and fix any formatting issues until Prettier reports all files correctly formatted
- [x] T032 [US2] Run `npm run test` and verify the sample test passes
- [x] T033 [US2] Run `npm run build` and verify Vite produces a production build in dist/ under 500KB gzipped

**Checkpoint**: User Story 2 complete — all quality commands pass on scaffolded code

---

## Phase 5: User Story 3 — Developer Deploys to Hosting (Priority: P2)

**Goal**: The project deploys to Vercel with SPA rewrites and serverless function routing working correctly

**Independent Test**: Deploy to Vercel, verify the SPA loads at the root URL, the placeholder API function responds, and client-side route refresh works

### Implementation for User Story 3

- [x] T034 [P] [US3] Create vercel.json with rewrites rule `{ "source": "/((?!api/).*)", "destination": "/index.html" }` for SPA routing at vercel.json
- [x] T035 [P] [US3] Create api/\_lib/supabase.js as the server-side Supabase client using SUPABASE_SERVICE_ROLE_KEY environment variable at api/\_lib/supabase.js
- [x] T036 [US3] Create api/hook/[slug].js as a placeholder serverless function that returns JSON with status, message, slug, method, and timestamp fields at api/hook/[slug].js
- [x] T037 [US3] Verify vercel.json rewrites do not conflict with api/ routes by confirming `/api/hook/test` hits the serverless function and `/any-other-path` serves index.html

**Checkpoint**: All user stories complete — project is installable, runnable, lintable, testable, buildable, and deployable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories

- [x] T038 Run full quickstart.md validation: clone → install → env setup → dev → lint → format → test → build → preview
- [x] T039 Verify `npm audit` reports zero high or critical severity vulnerabilities
- [x] T040 [P] Ensure all files follow naming conventions: kebab-case for JS files, PascalCase for Vue components, camelCase for variables/functions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; can run in parallel with US1 but quality checks validate US1 code, so sequential is preferred
- **User Story 3 (Phase 5)**: Depends on Phase 2 completion; can run in parallel with US1/US2 but deployment validates the full build
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each User Story

- Install dependencies before creating config files
- Config files before source files
- Source files before validation/verification tasks
- Verification is always the last task in each story

### Parallel Opportunities

- T007 and T008 can run in parallel (different files, no dependencies)
- T010, T011, and T012 can run in parallel (independent npm install commands)
- T023, T024, and T025 can run in parallel (independent npm install commands)
- T034 and T035 can run in parallel (different files, no dependencies)

---

## Parallel Example: User Story 1

```bash
# Install all US1 dependencies in parallel:
Task: "Install Tailwind CSS 3, PostCSS, and Autoprefixer"
Task: "Install PrimeVue 4, PrimeIcons, and tailwindcss-primeui"
Task: "Install @supabase/supabase-js"

# Then configure sequentially (config depends on installed packages):
Task: "Create tailwind.config.js"
Task: "Create postcss.config.js"
Task: "Create src/assets/main.css"
# ... remaining source files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T009)
3. Complete Phase 3: User Story 1 (T010–T022)
4. **STOP and VALIDATE**: Run `npm run dev` — dev server should start and render
5. This is a usable development environment

### Incremental Delivery

1. Setup + Foundational → Package.json and Vite configured
2. User Story 1 → Dev server works with Vue + PrimeVue + Tailwind (MVP!)
3. User Story 2 → Lint, format, test, build all pass
4. User Story 3 → Vercel deployment with serverless routing works
5. Polish → Full quickstart validation and audit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- npm install tasks within the same story can be combined into a single install command during implementation
- Verification tasks (T022, T030–T033, T037) are manual checks, not automated test tasks
- Commit after each phase or logical group of tasks
