# Quickstart: Project Scaffolding

**Feature**: 001-project-scaffolding
**Date**: 2026-02-09

## Prerequisites

- Node.js 20+ installed
- Git installed
- A terminal (bash, PowerShell, or zsh)

## Steps

### 1. Clone and install

```bash
git clone https://github.com/jbillay/hookspy.git
cd hookspy
npm install
```

**Verify**: No errors during install. Check for zero high/critical
vulnerabilities with `npm audit`.

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_APP_URL=http://localhost:5173
```

### 3. Start development server

```bash
npm run dev
```

**Verify**: Vite dev server starts on `http://localhost:5173`. The browser
shows a placeholder page with PrimeVue components and Tailwind CSS styling
applied.

### 4. Run quality checks

```bash
npm run lint          # ESLint — should pass with 0 errors
npm run format:check  # Prettier — should report all files formatted
npm run test          # Vitest — sample test should pass
```

**Verify**: All three commands exit with code 0.

### 5. Build for production

```bash
npm run build
```

**Verify**: Vite produces output in `dist/`. Total gzipped size should be
under 500KB.

### 6. Preview production build

```bash
npm run preview
```

**Verify**: The production build serves correctly at `http://localhost:4173`.

## Troubleshooting

| Problem                                               | Solution                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm install` fails with Node version error           | Upgrade to Node.js 20+                                                           |
| PrimeVue components render unstyled                   | Check that `tailwind.config.js` has `preflight: false`                           |
| Tailwind classes not applied                          | Verify `content` paths in `tailwind.config.js` include `./src/**/*.{vue,js}`     |
| `npm run lint` reports parsing errors on `.vue` files | Ensure `eslint-plugin-vue` is installed and configured                           |
| Vite HMR not working                                  | Check browser console for WebSocket connection errors; try restarting dev server |
