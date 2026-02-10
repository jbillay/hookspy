# HookSpy - Project Guide

## Project Overview

HookSpy is a webhook relay/proxy service that allows developers to intercept webhook
notifications via a unique URL, forward them through the browser to a local development
server, and relay the response back to the original sender — all in real time.

## Architecture

### High-Level Flow

```
External System --webhook--> Vercel Serverless Function --store--> Supabase (Postgres)
                                    |                                    |
                                    | (polls for response)       Realtime notify
                                    |                                    |
                                    v                                    v
External System <--response-- Serverless Function           Browser (Vue SPA)
                                                                |
                                                          fetch to localhost
                                                                |
                                                                v
                                                        Local Dev Server
```

The browser acts as the relay bridge. The SPA must be open for forwarding to work.
The serverless function holds the HTTP connection open, polling Supabase for the
browser-submitted response until timeout.

### Tech Stack

- **Frontend**: Vue 3 (Composition API) + Vite + JavaScript (no TypeScript)
- **UI Framework**: PrimeVue 4 (Aura theme) + Tailwind CSS
- **Backend**: Vercel Serverless Functions (JavaScript)
- **Database**: Supabase (PostgreSQL + Realtime + Auth)
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions

## Project Structure

```
hookspy/
├── api/                          # Vercel serverless functions (JS)
│   ├── hook/
│   │   └── [slug].js            # Webhook receiver (all HTTP methods)
│   ├── endpoints/
│   │   ├── index.js             # GET (list) / POST (create)
│   │   └── [id].js             # GET / PUT / DELETE
│   ├── logs/
│   │   ├── index.js             # GET (list with filters)
│   │   └── [id]/
│   │       ├── index.js         # GET single log
│   │       └── response.js     # POST browser submits relay response
│   └── _lib/
│       ├── supabase.js          # Server-side Supabase client (service role)
│       ├── auth.js              # JWT verification helper
│       └── cors.js              # CORS headers helper
├── src/
│   ├── assets/
│   │   └── main.css             # Tailwind imports
│   ├── components/
│   │   ├── layout/              # AppHeader, AppSidebar, AppLayout
│   │   ├── endpoints/           # EndpointCard, EndpointForm, HeaderInjectionEditor
│   │   ├── logs/                # LogList, LogDetail, LogFilters, PayloadViewer
│   │   └── relay/               # RelayStatus, RelayWorker
│   ├── composables/
│   │   ├── useSupabase.js
│   │   ├── useAuth.js
│   │   ├── useRelay.js
│   │   └── useEndpoints.js
│   ├── stores/                  # Pinia stores
│   │   ├── auth.js
│   │   ├── endpoints.js
│   │   └── logs.js
│   ├── views/
│   │   ├── LoginView.vue
│   │   ├── RegisterView.vue
│   │   ├── DashboardView.vue
│   │   ├── EndpointsView.vue
│   │   ├── EndpointDetailView.vue
│   │   └── LogDetailView.vue
│   ├── router/
│   │   └── index.js
│   ├── App.vue
│   └── main.js
├── supabase/
│   └── migrations/              # SQL migration files
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   ├── composables/
│   │   └── stores/
│   └── setup.js
├── .specify/                    # SpecKit SDD artifacts
│   ├── memory/
│   │   └── constitution.md
│   └── specs/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── .eslintrc.cjs
├── .prettierrc
├── vercel.json
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Coding Standards

### JavaScript

- ES modules (`import`/`export`) everywhere
- No TypeScript — plain JavaScript only
- Vue 3 Composition API with `<script setup>` syntax
- Use `ref`, `reactive`, `computed`, `watch` from Vue
- Async/await for all asynchronous operations
- Destructure props and composable returns

### Naming Conventions

- **Files**: kebab-case (`log-detail.js`, `LogDetail.vue`)
- **Vue components**: PascalCase filenames (`LogDetail.vue`)
- **Variables/functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS classes**: Tailwind utility classes; custom classes use kebab-case
- **Database columns**: snake_case
- **API routes**: kebab-case paths

### Vue Components

- One component per file
- Use `<script setup>` with Composition API
- Props defined with `defineProps()`
- Emits defined with `defineEmits()`
- PrimeVue components for UI elements (DataTable, Button, InputText, Dialog, etc.)
- Tailwind CSS for layout and custom styling
- No scoped styles unless absolutely necessary — prefer Tailwind

### Serverless Functions (api/)

- Each file exports a default function: `export default async function handler(req, res)`
- Always validate auth via JWT from `Authorization` header
- Use the shared `api/_lib/supabase.js` client with service role key
- Return proper HTTP status codes and JSON responses
- Handle CORS via the shared helper

### State Management

- Pinia for global state (auth, endpoints, logs)
- Composables for reusable logic (useRelay, useAuth)
- Component-local state with `ref`/`reactive` for UI-only state

### Error Handling

- API functions: try/catch with appropriate HTTP status codes
- Frontend: toast notifications via PrimeVue Toast for user-facing errors
- Console errors for development debugging
- Relay errors: displayed inline in the log viewer

## Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check (CI)
npm run test         # Run Vitest
npm run test:coverage # Run Vitest with coverage
```

## Environment Variables

### Frontend (prefixed with VITE\_)

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `VITE_APP_URL` — Production app URL (for CORS)

### Server-side (api/ functions only)

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (never exposed to client)

## Key Design Decisions

1. **Browser-based relay**: No CLI agent needed. The browser makes fetch requests
   to localhost. The local dev server MUST have CORS enabled.

2. **Polling in serverless functions**: The webhook receiver function polls Supabase
   every 500ms for the browser-submitted response. This is simple and reliable
   within Vercel's 60s function timeout.

3. **Supabase Realtime**: The browser subscribes to webhook_logs table changes
   filtered by the user's endpoint IDs to receive instant notifications of new
   incoming webhooks.

4. **24h log retention**: A Supabase pg_cron job cleans up logs older than 24 hours.

5. **No payload transformation**: Headers and bodies are forwarded exactly as received
   in both directions. Custom header injection is additive only.

6. **Configurable timeout**: Per-endpoint, default 30s, max 55s (within Vercel's
   60s limit with margin).

## Testing

- **Framework**: Vitest + @vue/test-utils
- **Coverage**: Aim for meaningful coverage on composables and stores
- **What to test**: Composables, Pinia stores, utility functions, component behavior
- **What NOT to test**: PrimeVue component internals, Tailwind classes
