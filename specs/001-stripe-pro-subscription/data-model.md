# Data Model: Stripe Pro Subscription Payments

## Existing Entities (No Migration Required)

### profiles (existing table)

The `profiles` table already contains the fields needed for Stripe integration:

| Column                 | Type           | Notes                                                   |
| ---------------------- | -------------- | ------------------------------------------------------- |
| id                     | uuid (PK)      | References auth.users(id)                               |
| email                  | text           | User's email                                            |
| plan                   | text           | 'free' or 'pro' — updated by webhook                    |
| plan_changed_at        | timestamptz    | Updated on plan change                                  |
| stripe_customer_id     | text, nullable | Stripe `cus_xxx` — set on first checkout                |
| stripe_subscription_id | text, nullable | Stripe `sub_xxx` — set on checkout, cleared on deletion |
| ...                    | ...            | Other existing columns unchanged                        |

### State Transitions

```text
FREE (no stripe fields)
  │
  ├─ checkout.session.completed
  │  → plan='pro', stripe_customer_id='cus_xxx', stripe_subscription_id='sub_xxx'
  │
  v
PRO (stripe fields populated)
  │
  ├─ customer.subscription.updated (status: canceled/past_due/unpaid)
  │  → plan='free', stripe_subscription_id cleared
  │  → Excess endpoints deactivated
  │
  ├─ customer.subscription.deleted
  │  → plan='free', stripe_subscription_id cleared
  │  → Excess endpoints deactivated
  │
  v
FREE (stripe_customer_id retained for re-subscription)
  │
  ├─ User re-subscribes (checkout with existing customer)
  │  → Reuses stripe_customer_id
  │
  v
PRO (stripe_subscription_id updated to new sub_xxx)
```

### Key Design Decisions

1. **stripe_customer_id is retained after downgrade**: Allows re-subscription without creating a new Stripe customer. The customer's payment history is preserved.

2. **stripe_subscription_id is cleared on downgrade**: Indicates no active subscription. Presence of this field (non-null) means active paid subscription.

3. **Admin-promoted Pro users**: Have `plan='pro'` but `stripe_customer_id=null` and `stripe_subscription_id=null`. The UI checks for `stripe_customer_id` to decide whether to show "Manage Subscription".

### Indexes

No new indexes needed. Existing `idx_profiles_plan` covers plan-based queries. A future optimization could add an index on `stripe_customer_id` for webhook lookups, but the profiles table is small enough that this is unnecessary at current scale.

## No New Tables

This feature requires no new database tables or migrations. All state is managed through existing `profiles` columns.
