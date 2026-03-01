# HookSpy Security Audit Report

**Date**: 2026-03-01
**Scope**: Full-stack audit — API endpoints, database/RLS, frontend, infrastructure
**Project**: HookSpy (hookspy.dev)

---

## Executive Summary

A comprehensive security audit identified **30 unique findings** across the entire HookSpy codebase. After deduplication across four audit domains (API, database, frontend, infrastructure), the consolidated results are:

| Severity | Count |
| -------- | ----- |
| CRITICAL | 5     |
| HIGH     | 8     |
| MEDIUM   | 10    |
| LOW      | 7     |

The most urgent issues are: rate limiting failing open on error, missing input validation on ID parameters, search query injection risk, an open redirect vulnerability, and missing Content Security Policy header.

---

## CRITICAL Findings

### C1. Rate Limiting Fails Open on Error

**Files**: `api/_lib/plans.js:95-98`
**CWE**: CWE-636 (Not Failing Securely)

When the `atomic_rate_limit_check` RPC call fails (database timeout, connection issue), the code defaults to **allowing** the request:

```javascript
if (error) {
  console.error('Rate limit check failed:', error.message)
  return { allowed: true, remaining: limits.requests_per_min, resetAt: null }
}
```

**Impact**: Complete rate limiting bypass during any database disruption. An attacker could trigger DB issues and then flood endpoints with unlimited requests.

**Fix**: Fail closed — deny requests when rate limiting cannot be verified:

```javascript
if (error) {
  console.error('Rate limit check failed - DENYING request:', error.message)
  return { allowed: false, remaining: 0, resetAt: null }
}
```

---

### C2. Missing UUID Validation on All ID Parameters

**Files**: `api/endpoints/[id].js:28`, `api/logs/[id].js:18`, `api/logs/[id]/response.js:21`, `api/logs/[id]/replay.js:28`, `api/admin/users/[id].js:20`
**CWE**: CWE-20 (Improper Input Validation)

No endpoint validates that `id` path parameters are valid UUIDs before querying the database. Invalid IDs trigger database errors that leak schema information (see C4).

**Impact**: Information disclosure via error enumeration, potential IDOR reconnaissance.

**Fix**: Add UUID validation helper to `api/_lib/auth.js` and use at the start of every ID-based endpoint:

```javascript
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isValidUUID(id) {
  return UUID_RE.test(id)
}
```

---

### C3. PostgREST Filter Injection in Search Query

**File**: `api/logs/index.js:68-74`
**CWE**: CWE-943 (Improper Neutralization of Special Elements in Data Query Logic)

The search sanitization only strips `[,.*()\\]` but misses PostgREST operators and LIKE wildcards (`%`, `_`). The sanitized string is concatenated directly into a PostgREST `.or()` filter string:

```javascript
const sanitized = q.replace(/[,.*()\\]/g, '').trim()
query = query.or(
  `request_body.ilike.%${sanitized}%,request_url.ilike.%${sanitized}%,...`,
)
```

**Impact**: An attacker can inject PostgREST filter operators or LIKE wildcards to extract data or cause unexpected query behavior.

**Fix**: Use allowlist sanitization + escape LIKE wildcards:

```javascript
const sanitized = q.replace(/[^a-zA-Z0-9\s\-@._]/g, '').trim()
if (!sanitized || sanitized.length < 2 || sanitized.length > 100) {
  return res
    .status(400)
    .json({ error: 'Search query must be 2-100 characters' })
}
const escaped = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_')
```

---

### C4. Database Error Messages Leaked to Clients

**Files**: `api/endpoints/index.js:30,76`, `api/endpoints/[id].js:108`, `api/logs/index.js:88`, `api/logs/[id].js:27`, `api/admin/index.js:109`
**CWE**: CWE-209 (Generation of Error Message Containing Sensitive Information)

All endpoints return `error.message` from Supabase directly to the client:

```javascript
if (error) {
  return res.status(500).json({ error: error.message })
}
```

**Impact**: Leaks PostgreSQL error details, table names, column types, and constraint names to attackers.

**Fix**: Return generic error messages; log details server-side:

```javascript
if (error) {
  console.error('[endpoints] DB error:', error.message)
  return res.status(500).json({ error: 'Internal server error' })
}
```

---

### C5. Open Redirect Vulnerability

**File**: `src/views/LoginView.vue:33-35`
**CWE**: CWE-601 (URL Redirection to Untrusted Site)

After login, the app redirects to a user-controlled query parameter without validation:

```javascript
const redirect = route.query.redirect
if (redirect) {
  router.push(redirect)
}
```

**Impact**: An attacker can craft `login?redirect=https://evil.com` to phish users after they authenticate.

**Fix**: Validate redirect is an internal route:

```javascript
if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
  router.push(redirect)
} else {
  router.push({ name: 'dashboard' })
}
```

---

## HIGH Findings

### H1. Missing Content Security Policy Header

**File**: `vercel.json:10-35`
**CWE**: CWE-693 (Protection Mechanism Failure)

The security headers include X-Frame-Options, HSTS, X-Content-Type-Options, etc., but no Content-Security-Policy header. This is the primary defense against XSS attacks.

**Fix**: Add to `vercel.json` headers array:

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
}
```

---

### H2. Auth Helper Returns Success for Missing Profiles

**File**: `api/_lib/auth.js:32-34`
**CWE**: CWE-863 (Incorrect Authorization)

When a profile cannot be fetched, the helper returns `{ user, profile: null, error: null }` — no error. Downstream code that checks only `authError` will proceed with a null profile:

```javascript
if (profileError || !profile) {
  return { user, profile: null, error: null }
}
```

**Impact**: A deleted or corrupt profile bypasses authorization if callers don't explicitly check `profile !== null`.

**Fix**:

```javascript
if (profileError || !profile) {
  return { user: null, profile: null, error: 'Failed to load user profile' }
}
```

---

### H3. SSRF Risk in Relay Target URL

**File**: `src/stores/relay.js:34-35`
**CWE**: CWE-918 (Server-Side Request Forgery)

The relay builds target URLs from endpoint config without validating the host or port:

```javascript
function buildTargetUrl(endpoint) {
  return `${endpoint.target_url}:${endpoint.target_port}${endpoint.target_path}`
}
```

**Impact**: A compromised endpoint config could direct traffic to internal IPs (192.168.x.x, 10.x.x.x) or privileged ports (22, 3306).

**Fix**: Validate host is localhost and port is non-privileged:

```javascript
const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']
function buildTargetUrl(endpoint) {
  const url = new URL(
    `${endpoint.target_url}:${endpoint.target_port}${endpoint.target_path}`,
  )
  if (!ALLOWED_HOSTS.includes(url.hostname))
    throw new Error('Only localhost allowed')
  const port = parseInt(endpoint.target_port)
  if (port < 1024 || port > 65535) throw new Error('Invalid port')
  return url.toString()
}
```

---

### H4. Missing Payload Size Limits on POST/PUT Endpoints

**Files**: `api/endpoints/index.js:37`, `api/endpoints/[id].js:46`, `api/logs/[id]/response.js:45`, `api/profile/index.js:56`, `api/admin/users/[id].js:66`
**CWE**: CWE-770 (Allocation of Resources Without Limits)

All body-accepting endpoints (except `api/hook/[slug].js`) accept request bodies without size validation.

**Impact**: Memory exhaustion DoS on serverless functions.

**Fix**: Add body size check or use Vercel's bodyParser config:

```javascript
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }
```

---

### H5. Missing Rate Limiting on User Mutation Endpoints

**Files**: `api/endpoints/index.js` (POST), `api/endpoints/[id].js` (PUT/DELETE), `api/logs/[id]/replay.js` (POST), `api/profile/index.js` (PUT/DELETE)
**CWE**: CWE-770 (Allocation of Resources Without Limits)

Only the webhook receiver (`api/hook/[slug].js`) has rate limiting. All other mutation endpoints allow unlimited operations.

**Impact**: Spam endpoint creation, replay abuse, rapid account changes.

**Fix**: Implement per-user rate limiting on all mutation endpoints using a similar pattern to webhook rate limiting.

---

### H6. Missing Insert/Delete Deny Policies on plan_config

**Table**: `plan_config`
**CWE**: CWE-862 (Missing Authorization)

The `plan_config` table only has SELECT and UPDATE policies. Without explicit INSERT/DELETE deny policies, authenticated users can insert new plan configurations or delete existing ones via the Supabase client.

**Impact**: Users could create custom plans with unlimited resources.

**Fix**:

```sql
CREATE POLICY plan_config_no_insert ON public.plan_config
  FOR INSERT WITH CHECK (false);
CREATE POLICY plan_config_no_delete ON public.plan_config
  FOR DELETE USING (false);
```

---

### H7. Response Header Injection in Webhook Relay

**File**: `api/hook/[slug].js:169-181`
**CWE**: CWE-113 (Improper Neutralization of CRLF Sequences in HTTP Headers)

Response headers from the browser-submitted relay response are copied to the HTTP response without CRLF validation:

```javascript
for (const [key, value] of Object.entries(current.response_headers)) {
  res.setHeader(key, value) // No CRLF check
}
```

**Impact**: HTTP response splitting attacks.

**Fix**: Filter CRLF and expand the header blacklist:

```javascript
const BLOCKED = new Set([
  'transfer-encoding',
  'connection',
  'content-length',
  'set-cookie',
  'content-security-policy',
])
for (const [key, value] of Object.entries(current.response_headers || {})) {
  if (/[\r\n]/.test(String(value))) continue
  if (BLOCKED.has(key.toLowerCase())) continue
  res.setHeader(key, value)
}
```

---

### H8. CORS Origin Validation Missing HTTPS Enforcement

**File**: `api/_lib/cors.js:1-16`
**CWE**: CWE-346 (Origin Validation Error)

The CORS helper splits `VITE_APP_URL` into allowed origins but doesn't validate that they use HTTPS in production. A misconfigured environment variable could allow HTTP origins.

**Fix**: Validate each origin has `https://` protocol in production.

---

## MEDIUM Findings

### M1. Admin Route Race Condition

**File**: `src/router/index.js:96-99`

Between auth initialization and `fetchProfile()` completion, `profile` is null and `isAdmin` is false. A fast navigation to `/admin` before the profile loads could briefly show incorrect state.

**Fix**: Await `fetchProfile()` in admin route guard before checking role.

---

### M2. No Content-Type Validation on Request Bodies

**Files**: All POST/PUT endpoints
**CWE**: CWE-20

Endpoints accepting JSON don't verify `Content-Type: application/json`, allowing non-JSON payloads.

**Fix**: Add Content-Type check before body processing.

---

### M3. Admin Audit Log Filters Not Validated

**File**: `api/admin/index.js:98-104`

`target_user_id` and `action` query params are passed directly to PostgREST without format or allowlist validation.

**Fix**: Validate UUID format for `target_user_id`, allowlist for `action`.

---

### M4. Admin Email Search Missing Sanitization

**File**: `api/admin/index.js:169`

The admin user search uses `.ilike('email', '%${search}%')` without escaping LIKE wildcards.

**Fix**: Escape `%` and `_` characters in search input.

---

### M5. Webhook Log RLS Allows Full-Row Updates

**Table**: `webhook_logs` UPDATE policy

The RLS policy allows updating any column on owned webhook logs. Application logic restricts fields, but a direct Supabase client call could modify `status`, `response_body`, etc.

**Fix**: This requires application-level enforcement since PostgreSQL RLS can't restrict specific columns. Consider using a database function for updates instead.

---

### M6. Missing Environment Variable Validation

**File**: `api/_lib/supabase.js:3-6`

No validation that `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist at initialization.

**Fix**: Throw at startup if missing.

---

### M7. Webhook readBody Missing Read Timeout

**File**: `api/hook/[slug].js:14-37`

The `readBody` function has size limits but no time limit. A slow-loris attack could hold the connection for the full 60s Vercel timeout.

**Fix**: Add a 10s read timeout via `setTimeout` + `req.destroy()`.

---

### M8. No Idempotency Keys on Create Operations

**Files**: `api/logs/[id]/replay.js`, `api/endpoints/index.js`

POST operations creating new records have no idempotency protection. Network retries can create duplicates.

**Fix**: Accept an `Idempotency-Key` header and check for existing records.

---

### M9. Leaked Password Protection Disabled

**Location**: Supabase Dashboard (not code)

Supabase Auth's leaked password protection (HaveIBeenPwned check) is disabled.

**Fix**: Enable in **Supabase Dashboard > Authentication > Settings > Password Security**.

---

### M10. Inconsistent Error Status Codes for Disabled Accounts

**Files**: `api/endpoints/index.js:18`, `api/endpoints/[id].js:24`

```javascript
const status = authError === 'account_disabled' ? 401 : 401 // Both branches return 401
```

**Fix**: Return 403 for disabled accounts.

---

## LOW Findings

### L1. Console Logging May Expose Sensitive Data

**Files**: Multiple API handlers

Error objects logged to console could contain user data visible in Vercel deployment logs.

**Fix**: Log only error codes/types, not full messages.

---

### L2. Missing `autocomplete` Attributes on Password Fields

**Files**: `src/views/LoginView.vue`, `RegisterView.vue`, `SettingsView.vue`

Password inputs lack explicit `autocomplete="current-password"` / `autocomplete="new-password"`.

**Fix**: Add appropriate autocomplete attributes.

---

### L3. External Fonts Loaded Without SRI

**File**: `index.html:10-11`

Google Fonts loaded without Subresource Integrity hashes.

**Fix**: Host fonts locally or add SRI attributes.

---

### L4. Webhook Request Headers Stored Without Filtering

**File**: `api/hook/[slug].js:121`

All incoming webhook headers (including potential Authorization tokens from senders) are stored in the database.

**Fix**: Filter sensitive headers before storage.

---

### L5. No Secret Rotation Policy Documented

**File**: `.github/workflows/ci-cd.yml:44-47`

Secrets (`VERCEL_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) have no documented rotation schedule.

**Fix**: Document 90-day rotation policy.

---

### L6. Failed Authentication Attempts Not Logged

**File**: `api/_lib/auth.js`

Auth failures return errors to clients but aren't logged server-side for security monitoring.

**Fix**: Log failed auth attempts with timestamp for abuse detection.

---

### L7. Dependency Vulnerabilities (npm audit)

**File**: `package.json`

Transitive dependencies (`rollup`, `minimatch`, `ajv`) have known vulnerabilities (ReDoS, path traversal).

**Fix**: Run `npm audit fix` and update affected packages.

---

## Actionable Task List

### Immediate (P0 — do now)

| #   | Task                                                      | Findings | Effort |
| --- | --------------------------------------------------------- | -------- | ------ |
| 1   | Fix rate limiting to fail closed (deny on error)          | C1       | 10 min |
| 2   | Add UUID validation helper + use in all ID endpoints      | C2       | 30 min |
| 3   | Fix search sanitization with allowlist + LIKE escaping    | C3       | 20 min |
| 4   | Replace all `error.message` responses with generic errors | C4       | 30 min |
| 5   | Fix open redirect in LoginView.vue                        | C5       | 5 min  |
| 6   | Add Content-Security-Policy header to vercel.json         | H1       | 15 min |
| 7   | Fix auth helper to return error on missing profile        | H2       | 5 min  |

### Short-term (P1 — this week)

| #   | Task                                                        | Findings | Effort |
| --- | ----------------------------------------------------------- | -------- | ------ |
| 8   | Add localhost + port validation in relay buildTargetUrl     | H3       | 20 min |
| 9   | Add body size limits to all POST/PUT endpoints              | H4       | 30 min |
| 10  | Add per-user rate limiting on mutation endpoints            | H5       | 1 hr   |
| 11  | Add INSERT/DELETE deny policies on plan_config              | H6       | 5 min  |
| 12  | Add CRLF check + header blacklist on webhook relay response | H7       | 15 min |
| 13  | Add HTTPS enforcement in CORS origin validation             | H8       | 15 min |
| 14  | Fix admin route guard to await profile before admin check   | M1       | 15 min |
| 15  | Add Content-Type validation on body-accepting endpoints     | M2       | 20 min |
| 16  | Enable leaked password protection in Supabase dashboard     | M9       | 2 min  |

### Medium-term (P2 — next 2 weeks)

| #   | Task                                                            | Findings | Effort |
| --- | --------------------------------------------------------------- | -------- | ------ |
| 17  | Validate admin audit log query params (UUID + action allowlist) | M3, M4   | 20 min |
| 18  | Add env var validation at startup in supabase.js                | M6       | 10 min |
| 19  | Add read timeout to webhook readBody function                   | M7       | 15 min |
| 20  | Fix disabled account status code (403 instead of 401)           | M10      | 5 min  |
| 21  | Add autocomplete attributes to password fields                  | L2       | 10 min |
| 22  | Filter sensitive headers before storing webhook requests        | L4       | 15 min |
| 23  | Log failed authentication attempts server-side                  | L6       | 15 min |
| 24  | Run npm audit fix for dependency vulnerabilities                | L7       | 10 min |

### Backlog (P3 — when convenient)

| #   | Task                                                              | Findings | Effort |
| --- | ----------------------------------------------------------------- | -------- | ------ |
| 25  | Add idempotency key support on create endpoints                   | M8       | 1 hr   |
| 26  | Use database functions for webhook_log updates (restrict columns) | M5       | 1 hr   |
| 27  | Sanitize console.error output to exclude user data                | L1       | 30 min |
| 28  | Host Google Fonts locally or add SRI                              | L3       | 30 min |
| 29  | Document secret rotation policy                                   | L5       | 15 min |

---

## Positive Findings (Already Secure)

These areas were audited and found to be well-implemented:

- **DOMPurify**: Properly used in PayloadViewer.vue with restrictive config (only `span` tags with `class` attribute)
- **Header filtering in relay**: Comprehensive forbidden-header list with prefix blocking (`proxy-`, `sec-`)
- **Route guards**: Protected routes properly guarded with auth metadata
- **RLS on core tables**: endpoints, webhook_logs, profiles all have proper row-level security
- **Service role key isolation**: Only used server-side in `api/_lib/supabase.js`, never exposed to frontend
- **HSTS**: Configured with 2-year max-age, includeSubDomains, and preload
- **JWT verification**: Auth helper properly verifies JWT via Supabase `getUser()` on every API call
- **Webhook timeout**: Per-endpoint configurable with max 55s (within Vercel's 60s limit)
- **Dark mode toggle**: Uses localStorage for non-sensitive preference only
