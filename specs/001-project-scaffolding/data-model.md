# Data Model: Project Scaffolding

**Feature**: 001-project-scaffolding
**Date**: 2026-02-09

## Overview

The project scaffolding feature does not introduce any application data
entities or database schema. Data modeling begins in feature
`002-database-schema`.

This document records the configuration entities that are created as part
of the scaffolding and serve as the structural foundation for future features.

## Configuration Entities

### Project Manifest (package.json)

| Attribute       | Description                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name            | `hookspy`                                                                                                                                                                        |
| version         | `0.0.0`                                                                                                                                                                          |
| type            | `module` (ES modules)                                                                                                                                                            |
| engines.node    | `>=20.0.0`                                                                                                                                                                       |
| scripts         | dev, build, preview, lint, lint:fix, format, format:check, test, test:coverage                                                                                                   |
| dependencies    | Vue 3, Vue Router 4, Pinia, PrimeVue 4, PrimeIcons, Tailwind CSS 3, @supabase/supabase-js                                                                                        |
| devDependencies | Vite 5, @vitejs/plugin-vue, ESLint, eslint-plugin-vue, eslint-config-prettier, Prettier, Vitest, @vue/test-utils, jsdom, @vitest/coverage-v8, tailwindcss, postcss, autoprefixer |

### Environment Variables (.env.example)

| Variable                  | Scope    | Description                                         |
| ------------------------- | -------- | --------------------------------------------------- |
| VITE_SUPABASE_URL         | Frontend | Supabase project URL                                |
| VITE_SUPABASE_ANON_KEY    | Frontend | Supabase anonymous/public key                       |
| VITE_APP_URL              | Frontend | Production app URL (for CORS)                       |
| SUPABASE_SERVICE_ROLE_KEY | Server   | Supabase service role key (never exposed to client) |

### Hosting Configuration (vercel.json)

| Setting   | Value                           | Purpose                     |
| --------- | ------------------------------- | --------------------------- |
| rewrites  | `/((?!api/).*)` → `/index.html` | SPA client-side routing     |
| functions | Auto-detected from `api/`       | Serverless function routing |

### Build Configuration (vite.config.js)

| Plugin             | Purpose                                      |
| ------------------ | -------------------------------------------- |
| @vitejs/plugin-vue | Vue 3 SFC compilation                        |
| vitest             | Test runner integration (via `defineConfig`) |

### CSS Configuration (tailwind.config.js)

| Setting               | Value                                     |
| --------------------- | ----------------------------------------- |
| content               | `["./index.html", "./src/**/*.{vue,js}"]` |
| corePlugins.preflight | `false` (PrimeVue coexistence)            |

## Relationships

```text
package.json ──defines──> scripts, dependencies
vite.config.js ──uses──> @vitejs/plugin-vue, vitest config
tailwind.config.js ──scans──> src/**/*.{vue,js}
vercel.json ──routes──> api/** (serverless), /** (SPA)
.env.example ──documents──> runtime environment variables
```

## Future Entities

The following entities will be introduced in subsequent features:

- **endpoints** table (feature 002/004)
- **webhook_logs** table (feature 002/005)
- **users** (managed by Supabase Auth, feature 003)
