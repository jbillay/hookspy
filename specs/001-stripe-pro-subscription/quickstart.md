# Quickstart: Stripe Pro Subscription Payments

## Prerequisites

Before starting implementation, the project owner must complete these manual Stripe Dashboard steps:

### 1. Create Product and Price

1. Go to Stripe Dashboard > Products
2. Create product: "HookSpy Pro"
3. Add price: 5.00 EUR / month (recurring)
4. Copy the `price_xxx` ID

### 2. Configure Customer Portal

1. Go to Stripe Dashboard > Settings > Billing > Customer portal
2. Enable: Cancel subscription, Update payment method, View invoices
3. Save configuration

### 3. Create Webhook Endpoint

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint URL: `https://<your-app-url>/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the signing secret (`whsec_xxx`)

### 4. Set Environment Variables in Vercel

```bash
STRIPE_SECRET_KEY=sk_live_xxx     # or sk_test_xxx for development
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID=price_xxx
```

## Local Development Testing

### Stripe CLI for Local Webhooks

```bash
# Install Stripe CLI
# Then forward webhooks to your local dev server:
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This outputs a temporary whsec_xxx for local testing
# Use that as STRIPE_WEBHOOK_SECRET in .env.local
```

### Test Cards

| Card                | Scenario           |
| ------------------- | ------------------ |
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0341 | Card declined      |
| 4000 0000 0000 9995 | Insufficient funds |

Use any future expiry date and any 3-digit CVC.

## Integration Test Scenarios

### Scenario 1: Free → Pro Upgrade

1. Log in as a free user
2. Go to Settings
3. Click "Upgrade to Pro — 5€/month"
4. Complete checkout with test card 4242...
5. Verify redirect to /settings?checkout=success
6. Verify plan badge shows "Pro"
7. Verify Pro features are unlocked (replay, search, headers)

### Scenario 2: Manage Subscription

1. Log in as a Pro user (paid via Stripe)
2. Go to Settings
3. Click "Manage Subscription"
4. Verify billing portal opens
5. Cancel subscription
6. Verify plan downgrades to Free (after billing period ends)

### Scenario 3: Admin-Promoted User

1. Log in as a Pro user promoted by admin (no stripe_customer_id)
2. Go to Settings
3. Verify "Manage Subscription" button is NOT shown
4. Verify plan features are shown normally

### Scenario 4: Re-subscription

1. Start as a Pro user who previously canceled
2. Verify stripe_customer_id is retained
3. Click "Upgrade to Pro" again
4. Verify checkout pre-fills customer info (reuses Stripe customer)
5. Complete payment
6. Verify plan is Pro again

### Scenario 5: Endpoint Deactivation on Downgrade

1. Create a Pro user with 5 active endpoints (free limit is 3)
2. Cancel subscription via portal
3. Verify downgrade sets plan to 'free'
4. Verify 2 most recently created endpoints are deactivated
5. Verify 3 oldest endpoints remain active
