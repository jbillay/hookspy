# HookSpy

**Intercept, inspect, and relay webhooks to your local dev server — no tunnels, no CLI, just your browser.**

[Get Started](https://hookspy.dev) | [Documentation](#how-it-works) | [Self-Host](#getting-started)

---

HookSpy is an open-source webhook debugging platform for developers. It gives you a unique public URL to receive webhooks from any provider (Stripe, GitHub, Twilio, etc.), displays them in a real-time dashboard, and forwards them through your browser to your local machine. Your local server's response is relayed back to the original sender, completing the full round trip.

No ngrok. No cloudflared. No CLI agent. Just open a browser tab.

## Why HookSpy?

| Pain Point | HookSpy Solution |
| --- | --- |
| Tunnels expose your entire machine | Only webhook traffic is forwarded, nothing else |
| CLI tools require installation and config | Zero install — works in any modern browser |
| Tunnel URLs change on restart | Persistent endpoint URLs that never change |
| Hard to inspect webhook payloads | Full request/response viewer with search and filters |
| Can't replay failed webhooks | One-click replay to re-test any past request |
| No visibility into what was sent back | See both the incoming request and your server's response side by side |

## How It Works

```
  Stripe / GitHub / Any Service
            │
            ▼
  ┌─────────────────────┐
  │  hookspy.dev/api/    │ ◄── Your unique public endpoint
  │  hook/abc123         │
  │  (Vercel Function)   │
  └─────────┬───────────┘
            │ stores request
            ▼
  ┌─────────────────────┐       ┌────────────────────┐
  │  Supabase            │──────▶│  Your Browser       │
  │  (Postgres +         │  RT   │  (HookSpy dashboard)│
  │   Realtime)          │◀──────│                      │
  └─────────────────────┘       └──────────┬───────────┘
                                           │ fetch()
                                           ▼
                                ┌────────────────────┐
                                │  localhost:3000     │
                                │  Your Dev Server    │
                                └────────────────────┘
```

1. **Create an endpoint** — Get a unique URL like `https://hookspy.dev/api/hook/abc123`
2. **Point your webhook provider** to that URL
3. **Open the dashboard** — Keep HookSpy open in your browser
4. **Develop locally** — Webhooks arrive in real time, get forwarded to localhost, and responses flow back to the sender

The browser acts as the relay bridge. As long as the tab is open, your webhooks flow.

## Features

### Core

- **Unique webhook URLs** — Create multiple endpoints, each with its own forwarding config
- **Real-time dashboard** — See webhooks the instant they arrive with live activity feed
- **Browser-based relay** — Your browser forwards requests to localhost and relays responses back
- **Full HTTP fidelity** — All methods (GET, POST, PUT, PATCH, DELETE), headers, and bodies are preserved exactly
- **Configurable forwarding** — Set target host, port, and path per endpoint
- **Configurable timeout** — Per-endpoint timeout (default 30s, max 55s)
- **Sub-path forwarding** — Webhooks to `/api/hook/abc123/stripe/events` forward to `localhost:3000/webhook/stripe/events`

### Debugging

- **Payload inspector** — View full request and response headers and body with syntax highlighting
- **Request replay** — Re-send any captured webhook to your local server with one click (Pro)
- **Search and filter** — Find past requests by HTTP method, status, time range, or body content (Pro)
- **CORS error detection** — Clear guidance when your local server's CORS config needs fixing

### Reliability

- **Adaptive transport** — Automatic fallback from WebSocket to HTTP polling when corporate firewalls block WebSocket connections
- **Reconnection handling** — Transparent reconnect with exponential backoff; auto-recovery when network is restored
- **Optimistic locking** — Multiple browser tabs won't double-process the same webhook
- **24-hour log retention** — Automatic cleanup keeps things tidy (Free); 7-day retention on Pro

### Platform

- **Multi-user** — Each user gets isolated endpoints, logs, and settings
- **Admin panel** — User management, plan changes, account status, audit logging
- **Dark mode** — Toggle between light and dark themes
- **Responsive** — Works on desktop, tablet, and mobile

## Plans

| | Free | Pro |
| --- | --- | --- |
| Endpoints | 3 | 25 |
| Rate limit | 30 req/min | 120 req/min |
| Max payload | 256 KB | 5 MB |
| Log retention | 6 hours | 7 days |
| Max timeout | 30s | 55s |
| Replay | — | Included |
| Search & filter | — | Included |
| Custom header injection | — | Included |

The Free plan is fully functional for most webhook development workflows. Pro unlocks higher limits and power-user features.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3 (Composition API) + Vite |
| UI Components | PrimeVue 4 (Aura theme) |
| Styling | Tailwind CSS 3 |
| State Management | Pinia |
| Backend | Vercel Serverless Functions (JavaScript) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password) |
| Real-time | Supabase Realtime (WebSocket) + HTTP polling fallback |
| Hosting | Vercel |
| CI/CD | GitHub Actions |
| Analytics | Vercel Analytics + Speed Insights |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Vercel](https://vercel.com/) account (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/jbillay/hookspy.git
cd hookspy
npm install --legacy-peer-deps
```

### 2. Configure environment

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_APP_URL=http://localhost:5173
```

### 3. Set up the database

Run the migrations in order against your Supabase project:

```bash
# Apply each file in supabase/migrations/ via the Supabase SQL editor
# or use the Supabase CLI:
supabase db push
```

### 4. Start development

```bash
npm run dev
```

### 5. Enable CORS on your local server

Your local dev server must allow cross-origin requests from your HookSpy domain. Example with Express.js:

```javascript
import cors from 'cors'
app.use(cors({ origin: 'http://localhost:5173' }))
```

<details>
<summary>CORS packages for other frameworks</summary>

| Framework | Package / Method |
| --- | --- |
| Express.js | `cors` |
| Flask | `flask-cors` |
| Django | `django-cors-headers` |
| FastAPI | `CORSMiddleware` |
| Spring Boot | `@CrossOrigin` annotation |
| ASP.NET | `UseCors()` middleware |
| Rails | `rack-cors` |
| Laravel | Built-in CORS middleware |
| Go (net/http) | Custom middleware or `rs/cors` |

</details>

## Development

```bash
npm run dev            # Start Vite dev server
npm run build          # Production build
npm run preview        # Preview production build
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run format:check   # Check formatting
npm run test           # Run unit tests (Vitest)
npm run test:coverage  # Tests with coverage report
```

## Project Structure

```
hookspy/
├── api/                        # Vercel serverless functions
│   ├── hook/[slug].js          # Webhook receiver (all HTTP methods)
│   ├── endpoints/              # Endpoint CRUD
│   ├── logs/                   # Log listing, detail, replay, response
│   ├── poll/index.js           # HTTP polling fallback endpoint
│   ├── profile/index.js        # User profile management
│   ├── admin/                  # Admin operations (consolidated)
│   └── _lib/                   # Shared helpers (auth, CORS, Supabase client)
├── src/
│   ├── components/             # Vue components (layout, endpoints, logs, relay, admin)
│   ├── composables/            # Reusable logic (auth, relay, transport, plans)
│   ├── stores/                 # Pinia stores (auth, endpoints, logs, relay, admin)
│   ├── views/                  # Page components
│   ├── router/                 # Vue Router config
│   └── assets/                 # Tailwind CSS entry
├── supabase/migrations/        # SQL migration files
├── tests/                      # Vitest unit tests
├── .github/workflows/          # CI/CD pipeline
└── vercel.json                 # Vercel config (rewrites, headers, functions)
```

## Deployment

HookSpy deploys automatically via GitHub Actions on push to `main`:

1. **Quality gates** — Lint, format check, unit tests
2. **Deploy** — Build and deploy to Vercel (only if all checks pass)

Auto-deployment on git push is disabled in Vercel — deployments happen exclusively through the CI/CD pipeline.

## Architecture Notes

- **Browser as relay**: The SPA acts as a proxy bridge. The serverless function holds the HTTP connection open, polling Supabase for the browser-submitted response (up to 55s within Vercel's 60s limit).
- **Adaptive transport**: The app tries WebSocket (Supabase Realtime) first. If 3 consecutive failures occur within 30 seconds, it transparently falls back to HTTP polling (2s interval). It periodically retries WebSocket to switch back when the network allows.
- **Serverless function limit**: Vercel Hobby plan allows max 12 functions. Admin endpoints are consolidated into a single handler with query-param routing to stay under the limit.
- **Rate limiting**: Atomic per-minute counters via Supabase RPC with tumbling window.
- **Log cleanup**: A `pg_cron` job deletes logs older than each plan's retention period.

## Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a pull request against `main`

If you find a bug or have a feature request, [open an issue](https://github.com/jbillay/hookspy/issues).

## License

[MIT](LICENSE)
