# Quickstart: Endpoint Management

**Feature**: 004-endpoint-management

## Prerequisites

- Node.js 20+
- HookSpy repo cloned with `npm install` completed
- `.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Supabase database migrations applied (`npx supabase db push`)
- Auth feature (003) working — user can sign in

## Development Workflow

### 1. Start dev server

```bash
npm run dev
```

### 2. Key files to implement (in order)

**API layer** (server-side):

1. `api/_lib/cors.js` — CORS helper (shared by all API routes)
2. `api/endpoints/index.js` — GET list + POST create
3. `api/endpoints/[id].js` — GET single + PUT update + DELETE

**State layer** (client-side): 4. `src/stores/endpoints.js` — Pinia store with CRUD methods 5. `src/composables/use-endpoints.js` — Thin wrapper

**UI components**: 6. `src/components/endpoints/HeaderInjectionEditor.vue` — Key-value pair editor 7. `src/components/endpoints/EndpointForm.vue` — Create/edit form (uses HeaderInjectionEditor) 8. `src/components/endpoints/EndpointCard.vue` — Card for list view

**Views & routing**: 9. `src/views/EndpointsView.vue` — List view with empty state 10. `src/views/EndpointDetailView.vue` — Create/edit view 11. `src/router/index.js` — Add routes for endpoints

**Navigation**: 12. `src/components/layout/AppHeader.vue` — Add endpoints nav link

### 3. Testing

```bash
npm run test           # All tests
npm run test:coverage  # With coverage
npm run lint           # Lint check
npm run format:check   # Format check
```

### 4. Key patterns to follow

- **API handlers**: `export default async function handler(req, res)` with `verifyAuth(req)` guard
- **Store**: `defineStore('endpoints', () => {})` with `ref()` state, async methods returning `{ data, error }`
- **Components**: `<script setup>` with PrimeVue components + Tailwind
- **Tests**: Mock Supabase client, test store methods, validate form logic

### 5. Verify manually

1. Sign in at `/login`
2. Navigate to `/endpoints` — should show empty state
3. Click "Create your first endpoint" → navigate to `/endpoints/new`
4. Fill in name, submit → redirected to list with new endpoint card
5. Click edit on card → navigate to `/endpoints/:id` with pre-populated form
6. Toggle active/inactive switch on card
7. Delete endpoint with confirmation dialog
8. Copy webhook URL to clipboard
