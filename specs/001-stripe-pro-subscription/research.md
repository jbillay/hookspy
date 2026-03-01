# Research: Stripe Pro Subscription Payments

## R1: Stripe SDK in Vercel Serverless Functions (ES Modules)

**Decision**: Use `stripe` npm package with direct ES module import.

**Rationale**: The `stripe` package ships an ES module entry point. `import Stripe from 'stripe'` works natively in Vercel serverless functions without bundler config. Pin `apiVersion` explicitly to avoid breaking changes.

**Pattern**:

```javascript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
```

**Alternatives considered**: None — `stripe` is the official SDK.

## R2: Raw Body Handling for Webhook Signature Verification

**Decision**: Disable Vercel body auto-parsing for the entire handler file and manually read the raw body using Node.js stream collection (no extra dependency).

**Rationale**: Stripe's `webhooks.constructEvent()` requires the exact raw request body (as Buffer) for HMAC signature verification. Vercel's auto body parser consumes the stream and returns parsed JSON, destroying the original bytes. Since all three routes (checkout, portal, webhook) share one file, body parsing is disabled globally. Checkout/portal routes manually `JSON.parse()` the raw body; webhook route passes it directly to `constructEvent()`.

**Pattern**:

```javascript
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
```

**Alternatives considered**:

- `raw-body` npm package — works but adds an unnecessary dependency for ~5 lines of code.
- Separate files for webhook vs checkout/portal — would use 2 function slots (only 1 available).

## R3: Consolidated Route Pattern

**Decision**: Single `api/stripe/index.js` with `_route` query parameter, matching the existing `api/admin/index.js` pattern. Vercel rewrites map clean URLs to query params.

**Rationale**: Vercel Hobby plan has a 12-function limit; project is at 11/12. Using 3 separate files would exceed the limit. The `_route` pattern is already established in the codebase.

**Routes**:

- `POST /api/stripe/checkout` → `_route=checkout` (JWT auth)
- `POST /api/stripe/portal` → `_route=portal` (JWT auth)
- `POST /api/stripe/webhook` → `_route=webhook` (Stripe signature auth)

**Alternatives considered**:

- Separate files per route — blocked by function limit.
- Merging with existing admin handler — different auth requirements (JWT vs Stripe signature), different body parsing needs; would add too much complexity to admin handler.

## R4: Stripe Checkout Session Configuration

**Decision**: Use `stripe.checkout.sessions.create()` with `mode: 'subscription'`, reusing `stripe_customer_id` if available.

**Key parameters**:

- `mode: 'subscription'`
- `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`
- `client_reference_id: userId` — for webhook correlation
- `metadata: { user_id: userId }` — on both session and subscription
- `customer` (if `stripe_customer_id` exists) OR `customer_email` (mutually exclusive)
- `success_url` / `cancel_url` with query params for toast display

**Gotcha**: `customer` and `customer_email` are mutually exclusive — cannot set both.

## R5: Stripe Customer Portal

**Decision**: Use `stripe.billingPortal.sessions.create()` with `return_url` pointing back to Settings page.

**Prerequisite**: Customer Portal must be configured in Stripe Dashboard (Billing > Customer portal) before first use. Without this, the API returns a 400 error.

**Pattern**:

```javascript
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${process.env.VITE_APP_URL}/settings`,
})
```

## R6: Webhook Event Handling

**Decision**: Handle 4 event types with idempotent processing.

| Event                           | Action                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| `checkout.session.completed`    | Set plan='pro', store stripe_customer_id + stripe_subscription_id |
| `customer.subscription.updated` | If status is `canceled`, `past_due`, or `unpaid` → downgrade      |
| `customer.subscription.deleted` | Downgrade to free, clear stripe fields                            |
| `invoice.payment_failed`        | Log only — subscription.updated handles state                     |

**Idempotency**: Downgrade logic checks current plan before modifying. Setting plan='pro' when already 'pro' is a no-op. Setting plan='free' when already 'free' is a no-op. Excess endpoint deactivation only runs when current active count exceeds free limit.

**Correlation**: Use `client_reference_id` from checkout session. For subscription events, look up user by `stripe_customer_id` in profiles table.

## R7: Downgrade Logic Extraction

**Decision**: Extract the endpoint deactivation logic from `api/admin/users/[id].js` into a shared `downgradeToFree(userId)` function in `api/_lib/plans.js`.

**Rationale**: Same deactivation logic is needed in both admin plan changes and Stripe webhook subscription cancellation. DRY principle.

**Function signature**:

```javascript
export async function downgradeToFree(userId) → { endpointsDeactivated: number }
```

**Behavior**:

1. Update profile: `plan='free'`, `plan_changed_at=now()`
2. Get free plan limits
3. Count active endpoints
4. If active > max, deactivate most recently created excess endpoints
5. Return count of deactivated endpoints
