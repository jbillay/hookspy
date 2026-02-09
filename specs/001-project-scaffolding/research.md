# Research: Project Scaffolding

**Feature**: 001-project-scaffolding
**Date**: 2026-02-09

## Resolved Decisions

### 1. Vue 3 Project Initialization

**Decision**: Use `npm create vue@latest` scaffolding approach (without
TypeScript, JSX, or SSR), then layer on PrimeVue and Tailwind manually.

**Rationale**: The official `create-vue` tool uses Vite under the hood and
supports opt-in features. Starting from this base ensures we get the correct
Vite + Vue 3 integration including HMR, proper plugin ordering, and the
`@vitejs/plugin-vue` setup. Manual additions (PrimeVue, Tailwind) give full
control over configuration.

**Alternatives considered**:

- Vite CLI (`npm create vite@latest` with vue template) — lighter but lacks
  Vue Router and Pinia scaffolding; would require more manual wiring.
- Nuxt 3 — too opinionated for this project's serverless architecture;
  introduces SSR complexity we explicitly avoid.

### 2. PrimeVue 4 + Tailwind CSS Coexistence

**Decision**: Install PrimeVue 4 with the Aura unstyled preset and use the
`tailwindcss-primeui` plugin to bridge PrimeVue's design tokens with Tailwind
utilities. Disable Tailwind's `preflight` reset to avoid stripping PrimeVue's
base styles.

**Rationale**: PrimeVue 4 introduced an unstyled mode with design token
presets (Aura, Lara, Nora). Using Aura with the Tailwind integration plugin
ensures PrimeVue components respond to Tailwind classes natively. Disabling
preflight prevents the CSS reset from breaking PrimeVue component rendering.

**Alternatives considered**:

- PrimeVue styled mode (legacy) — harder to customize with Tailwind; adds
  CSS specificity conflicts.
- Separate CSS scoping — adds complexity without benefit; the plugin handles
  coexistence cleanly.

### 3. ESLint + Prettier Integration

**Decision**: Use `eslint-plugin-vue` (recommended ruleset),
`eslint-config-prettier` to disable ESLint rules that conflict with Prettier,
and a standalone `.prettierrc` for formatting rules. ESLint uses flat config
format (eslint.config.js) if supported by tooling, otherwise `.eslintrc.cjs`.

**Rationale**: This is the standard Vue ecosystem approach. Separating
concerns (ESLint for logic errors, Prettier for formatting) avoids rule
conflicts. The `eslint-config-prettier` package explicitly disables
overlapping rules.

**Alternatives considered**:

- `eslint-plugin-prettier` (running Prettier as ESLint rule) — slower; mixes
  concerns; deprecated in favor of separation.
- Biome — insufficient Vue SFC support as of 2026.

### 4. Vitest Configuration

**Decision**: Use Vitest with jsdom environment, `@vue/test-utils` for
component mounting, and a global setup file (`tests/setup.js`) for common
configuration. Coverage via `@vitest/coverage-v8`.

**Rationale**: Vitest is Vite-native, shares the same config and transform
pipeline, and provides near-instant HMR-aware test runs. jsdom is the
standard DOM environment for Vue component testing.

**Alternatives considered**:

- Jest — requires separate configuration and Babel transform; slower for
  Vite projects.
- happy-dom — slightly faster than jsdom but less complete DOM API coverage.

### 5. Vercel Deployment Configuration

**Decision**: Use `vercel.json` with:

- `rewrites`: `[{ "source": "/((?!api/).*)", "destination": "/index.html" }]`
  for SPA client-side routing
- Serverless functions auto-detected from `api/` directory
- No custom build command (Vercel detects Vite automatically)

**Rationale**: Vercel's zero-config Vite detection handles the build step.
The rewrite rule ensures client-side routes work on page refresh while
excluding `/api/*` paths from the SPA catch-all.

**Alternatives considered**:

- Custom `vercel.json` build configuration — unnecessary complexity; Vite is
  auto-detected.
- Netlify — not the selected hosting platform per constitution.

### 6. Supabase Client Composable

**Decision**: Create `useSupabase.js` as a Vue composable that lazily
initializes a singleton `@supabase/supabase-js` client using `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` environment variables. The composable returns
the client instance for use in other composables and stores.

**Rationale**: A composable pattern aligns with Vue 3 Composition API
conventions. Lazy singleton prevents multiple client instantiations. Using
the anon key (not service role) ensures the client is safe for browser use.

**Alternatives considered**:

- Global plugin (`app.provide`) — less explicit; harder to test in isolation.
- Direct import in each file — would create multiple client instances.

### 7. Server-Side Supabase Client

**Decision**: Create `api/_lib/supabase.js` that initializes a Supabase client
with the `SUPABASE_SERVICE_ROLE_KEY` for use in serverless functions.

**Rationale**: The service role key bypasses Row Level Security and is needed
for server-side operations. Keeping it in `api/_lib/` ensures it's never
bundled into the frontend build (Vite only processes `src/`).

**Alternatives considered**:

- Shared client between frontend and backend — impossible due to different
  key requirements (anon vs service role).
