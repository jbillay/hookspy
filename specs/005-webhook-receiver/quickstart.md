# Quickstart: Webhook Receiver

**Feature**: 005-webhook-receiver

## What This Feature Does

Implements the server-side half of the webhook relay. When an external system (e.g., Stripe, GitHub) sends a webhook to a HookSpy URL, the serverless function:

1. Stores the incoming request in the database
2. Holds the HTTP connection open, polling for a response
3. Returns the local dev server's response back to the external system

The browser relay (a future feature) will complete the other half by forwarding stored requests to localhost and posting responses back.

## Files to Create/Modify

| File                                  | Action  | Description                           |
| ------------------------------------- | ------- | ------------------------------------- |
| `api/hook/[slug].js`                  | Replace | Webhook receiver with polling loop    |
| `api/logs/[id]/response.js`           | Create  | Response submission for browser relay |
| `tests/unit/api/hook-slug.test.js`    | Create  | Webhook receiver tests                |
| `tests/unit/api/log-response.test.js` | Create  | Response submission tests             |

## Key Implementation Notes

1. **Raw body access**: The webhook receiver must disable Vercel's body parser (`config.api.bodyParser = false`) to preserve raw request bodies. Read the body from the request stream manually.

2. **Polling loop**: Use `setTimeout`-based loop (not `setInterval`) with async/await. Poll Supabase every 500ms. The loop runs inside the handler function, keeping the HTTP connection open.

3. **Rate limiting**: In-memory Map keyed by slug + minute window. Resets on cold start — acceptable for current scale.

4. **Auth split**: `/api/hook/[slug]` is unauthenticated (external systems call it). `/api/logs/[id]/response` requires JWT auth (browser relay calls it).

5. **Status transitions**: The webhook receiver writes `pending` on insert. It only reads status during polling — it never writes `responded` or `error`. The response submission endpoint handles those writes. The receiver writes `timeout` when the polling loop expires.

## Testing Strategy

Tests mock the Supabase client (following existing pattern in `tests/unit/api/auth.test.js`). Key scenarios:

- Active endpoint → log created with correct data → poll returns response → caller gets exact response
- Inactive/missing endpoint → 404
- Body > 1MB → 413
- Rate limit exceeded → 429
- Timeout → log updated to `timeout` → 504
- Response submission: auth required, ownership verified, 409 for resolved logs

## Manual Testing

```bash
# Create an endpoint first (via the app or API)
# Then test the webhook receiver:

# Basic webhook
curl -X POST http://localhost:3000/api/hook/your-slug \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'

# Submit a response (simulating browser relay)
curl -X POST http://localhost:3000/api/logs/{log-id}/response \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": 200, "headers": {"Content-Type": "application/json"}, "body": "{\"ok\":true}"}'
```

## Dependencies

- No new npm packages needed
- Uses existing `api/_lib/supabase.js`, `api/_lib/auth.js`, `api/_lib/cors.js`
- Database schema already in place (migrations from feature 002)
