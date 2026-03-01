# Implementation Plan: Stripe Pro Subscription Payments

**Branch**: `001-stripe-pro-subscription` | **Date**: 2026-03-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-stripe-pro-subscription/spec.md`

## Summary

Add self-service Stripe subscription payments so free users can upgrade to Pro (5€/month EUR) via Stripe Checkout, and Pro subscribers can manage billing via Stripe Customer Portal. Webhook events handle automatic plan upgrades/downgrades. All three routes (checkout, portal, webhook) are consolidated into a single serverless function to stay within Vercel's 12-function Hobby plan limit.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 20+
**Primary Dependencies**: `stripe` npm package (server-side only), Vue 3, PrimeVue 4, Pinia
**Storage**: Supabase PostgreSQL — existing `profiles` table already has `stripe_customer_id` and `stripe_subscription_id` columns
**Testing**: Vitest + @vue/test-utils
**Target Platform**: Vercel (serverless functions + static SPA)
**Project Type**: Web application (Vue SPA frontend + Vercel serverless backend)
**Performance Goals**: Checkout redirect < 2s, webhook processing < 5s
**Constraints**: Max 12 serverless functions on Vercel Hobby plan (currently 11 used, 1 slot remaining). All routes must share a single `api/stripe/index.js` file.
**Scale/Scope**: Standard SaaS subscription flow, single price tier

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                          | Status | Notes                                                                                                                                           |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Plain JavaScript, No Exceptions | PASS   | All code is plain JS with ES modules                                                                                                            |
| II. Browser-as-Bridge              | PASS   | Feature does not affect relay architecture. Stripe Checkout/Portal are full-page redirects, not embedded.                                       |
| III. Full HTTP Fidelity            | N/A    | Feature does not modify webhook relay behavior                                                                                                  |
| IV. Meaningful Testing             | PASS   | Will test stripe handler routes, downgrade helper, and UI state logic. Will NOT test Stripe SDK internals.                                      |
| V. Simplicity & Minimal Scope      | PASS   | Single serverless function, no new abstractions beyond the shared downgrade helper. Stripe Checkout/Portal are hosted — zero custom payment UI. |

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-stripe-pro-subscription/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── stripe-api.md    # API contract for stripe endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
api/
├── stripe/
│   └── index.js         # NEW — consolidated checkout + portal + webhook handler
├── _lib/
│   └── plans.js         # MODIFIED — add shared downgradeToFree() helper
└── ... (existing)

src/
├── views/
│   └── SettingsView.vue  # MODIFIED — upgrade button + manage subscription button
└── ... (existing)

vercel.json               # MODIFIED — add stripe route rewrites
package.json              # MODIFIED — add stripe dependency
```

**Structure Decision**: Follows existing project structure. Single new file `api/stripe/index.js` using the same `_route` query parameter consolidation pattern as `api/admin/index.js`. Shared downgrade logic extracted into existing `api/_lib/plans.js`. Frontend changes limited to `SettingsView.vue`.
