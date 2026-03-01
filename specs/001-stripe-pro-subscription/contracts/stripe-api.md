# API Contract: Stripe Endpoints

All routes are served by a single serverless function `api/stripe/index.js` via Vercel rewrites.

## POST /api/stripe/checkout

Creates a Stripe Checkout Session for Pro subscription upgrade.

**Auth**: JWT (Authorization: Bearer \<token\>)

**Request Body**:

```json
(no body required — user info extracted from JWT)
```

**Response 200**:

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_xxx..."
}
```

**Response 401**:

```json
{
  "error": "Missing or invalid Authorization header"
}
```

**Response 400**:

```json
{
  "error": "Already subscribed to Pro"
}
```

**Response 500**:

```json
{
  "error": "Failed to create checkout session"
}
```

**Behavior**:

1. Verify JWT, get user profile
2. If user already has `plan='pro'` AND `stripe_subscription_id` is set → 400
3. If user has `stripe_customer_id` → reuse as `customer` param
4. Otherwise → use `customer_email` from profile
5. Create Checkout Session: mode=subscription, price=STRIPE_PRICE_ID, client_reference_id=userId
6. Return session URL

---

## POST /api/stripe/portal

Creates a Stripe Customer Portal session for subscription management.

**Auth**: JWT (Authorization: Bearer \<token\>)

**Request Body**:

```json
(no body required — user info extracted from JWT)
```

**Response 200**:

```json
{
  "url": "https://billing.stripe.com/p/session/xxx..."
}
```

**Response 401**:

```json
{
  "error": "Missing or invalid Authorization header"
}
```

**Response 400**:

```json
{
  "error": "No billing account found"
}
```

**Behavior**:

1. Verify JWT, get user profile
2. If `stripe_customer_id` is null → 400 (admin-promoted user, no Stripe customer)
3. Create Portal Session with customer ID and return_url=/settings
4. Return portal URL

---

## POST /api/stripe/webhook

Handles Stripe webhook events for subscription lifecycle management.

**Auth**: Stripe signature verification (stripe-signature header)

**Request Body**: Raw Stripe event payload (JSON, not pre-parsed)

**Response 200**:

```json
{
  "received": true
}
```

**Response 400**:

```json
{
  "error": "Webhook Error: <signature verification failure message>"
}
```

**Handled Events**:

### checkout.session.completed

- Extract `client_reference_id` (user ID), `customer` (Stripe customer ID), `subscription` (Stripe subscription ID)
- Update profiles: `plan='pro'`, `stripe_customer_id`, `stripe_subscription_id`, `plan_changed_at=now()`

### customer.subscription.updated

- Look up user by `stripe_customer_id` from subscription's `customer` field
- If status is `active` → ensure plan is 'pro' (re-activation)
- If status is `canceled`, `past_due`, or `unpaid` → call `downgradeToFree(userId)`

### customer.subscription.deleted

- Look up user by `stripe_customer_id`
- Call `downgradeToFree(userId)`
- Clear `stripe_subscription_id` (retain `stripe_customer_id`)

### invoice.payment_failed

- Log the event (console.error with user context)
- No plan change (subscription.updated handles state transitions)

### Unhandled events

- Log event type
- Return 200 (never error on unknown events)

---

## Vercel Rewrites

```json
{ "source": "/api/stripe/checkout", "destination": "/api/stripe?_route=checkout" },
{ "source": "/api/stripe/portal", "destination": "/api/stripe?_route=portal" },
{ "source": "/api/stripe/webhook", "destination": "/api/stripe?_route=webhook" }
```

---

## Environment Variables

| Variable                | Scope            | Description                                                 |
| ----------------------- | ---------------- | ----------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Server-side only | Stripe secret API key (sk*live*... or sk*test*...)          |
| `STRIPE_WEBHOOK_SECRET` | Server-side only | Webhook endpoint signing secret (whsec\_...)                |
| `STRIPE_PRICE_ID`       | Server-side only | Pro plan price ID (price\_...)                              |
| `VITE_APP_URL`          | Both (existing)  | Used for checkout success/cancel URLs and portal return URL |
