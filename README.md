# HookSpy

**Intercept, inspect, and relay webhooks to your local development server — right from your browser.**

HookSpy is an open-source webhook debugging tool that gives you a unique public URL to receive webhook notifications, displays them in a real-time dashboard, and forwards them to your local machine through the browser. Your local server's response is then relayed back to the original sender, completing the round trip — no tunnels, no CLI tools, just an open browser tab.

## How It Works

```
                         ┌─────────────────────────────────────┐
                         │           YOUR BROWSER               │
                         │      (HookSpy dashboard open)        │
                         │                                       │
                         │  Receives webhook via Realtime ──────┐│
                         │  Forwards to localhost:PORT    ──────┤│
                         │  Sends response back to API   ──────┘│
                         └──────────┬───────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               │               ▼
           ┌──────────────┐        │      ┌──────────────────┐
           │   Supabase   │◄───────┘      │  Your Local Dev  │
           │  (Database + │               │     Server       │
           │   Realtime)  │               │  localhost:3000  │
           └──────┬───────┘               └──────────────────┘
                  │
                  ▼
  ┌──────────┐        ┌────────────────────┐
  │ External  │──────▶│  HookSpy Endpoint  │
  │  System   │       │  /api/hook/:slug   │
  │ (Stripe,  │◀──────│                    │
  │  GitHub)  │       │  (Vercel Function) │
  └──────────┘        └────────────────────┘
```

1. **Create an endpoint** — HookSpy generates a unique public URL (e.g., `https://hookspy.vercel.app/api/hook/abc123`)
2. **Configure your webhook provider** — Point Stripe, GitHub, or any service to your HookSpy URL
3. **Open the dashboard** — Keep the HookSpy dashboard open in your browser
4. **Receive and relay** — When a webhook arrives, HookSpy stores it and notifies your browser in real time. Your browser forwards the request to your local dev server and relays the response back to the original sender.

## Features

- **Unique webhook URLs** — Create as many endpoints as you need, each with its own configuration
- **Real-time dashboard** — See incoming webhooks and responses the instant they arrive
- **Browser-based relay** — No CLI tools or tunnels required; your browser does the forwarding
- **Full HTTP fidelity** — All methods (GET, POST, PUT, PATCH, DELETE), headers, and bodies are forwarded without alteration
- **Header injection** — Add custom headers (e.g., auth tokens) when forwarding to your local server
- **Request replay** — Re-send any captured webhook to your local server for debugging
- **Search and filter** — Find past requests by method, status, time range, or body content
- **Configurable timeout** — Set per-endpoint timeouts (default: 30s, max: 55s)
- **24-hour log retention** — Automatic cleanup keeps your dashboard clean
- **Multi-user** — Each user gets their own isolated endpoints and logs

## Tech Stack

| Layer         | Technology                               |
| ------------- | ---------------------------------------- |
| Frontend      | Vue 3 (Composition API) + Vite           |
| UI Components | PrimeVue 4 (Aura theme)                  |
| Styling       | Tailwind CSS                             |
| Backend       | Vercel Serverless Functions (JavaScript) |
| Database      | Supabase (PostgreSQL)                    |
| Auth          | Supabase Auth                            |
| Real-time     | Supabase Realtime                        |
| Hosting       | Vercel                                   |
| CI/CD         | GitHub Actions                           |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Vercel](https://vercel.com/) account (free tier works)
- Your local dev server must have **CORS enabled** (allow requests from your HookSpy domain)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/jbillay/hookspy.git
cd hookspy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_APP_URL=http://localhost:5173
```

### 4. Set up the database

Run the SQL migrations in your Supabase project (see `supabase/migrations/`).

### 5. Start development

```bash
npm run dev
```

### 6. Enable CORS on your local server

Your local development server must allow cross-origin requests from your HookSpy domain. For example, with Express.js:

```javascript
import cors from 'cors'
app.use(cors({ origin: 'http://localhost:5173' }))
```

## Development

```bash
npm run dev            # Start development server
npm run build          # Production build
npm run preview        # Preview production build
npm run lint           # Run ESLint
npm run format:check   # Check Prettier formatting
npm run test           # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

## Deployment

HookSpy is designed to be deployed on Vercel. The GitHub Actions CI/CD pipeline automatically:

1. Runs ESLint and Prettier checks
2. Executes unit tests
3. Deploys to Vercel (on push to `main`, if all checks pass)

## CORS Requirement

Since HookSpy relays webhooks through the browser, your local development server **must** return appropriate CORS headers. If the browser cannot reach your local server due to CORS restrictions, HookSpy will display an error in the log viewer with guidance on how to fix it.

Most frameworks have CORS middleware available:

| Framework   | Package                   |
| ----------- | ------------------------- |
| Express.js  | `cors`                    |
| Flask       | `flask-cors`              |
| Django      | `django-cors-headers`     |
| Spring Boot | `@CrossOrigin` annotation |
| ASP.NET     | `UseCors()` middleware    |
| FastAPI     | `CORSMiddleware`          |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
