# Tasks: Stripe Pro Subscription Payments

**Input**: Design documents from `/specs/001-stripe-pro-subscription/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/stripe-api.md, quickstart.md

**Tests**: Included — project has existing test infrastructure and constitution requires meaningful testing.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies and configure routing infrastructure

- [x] T001 Install `stripe` npm package via `npm install stripe --legacy-peer-deps` in package.json
- [x] T002 Add Vercel rewrites for `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook` to `api/stripe?_route=<route>` in vercel.json

**Checkpoint**: Dependencies installed, routes configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared helpers that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Extract `downgradeToFree(userId)` helper into api/\_lib/plans.js — moves endpoint deactivation logic from api/admin/users/[id].js into a reusable function that: sets plan='free', sets plan_changed_at, counts active endpoints, deactivates excess (most recently created first), returns { endpointsDeactivated }
- [x] T004 Refactor api/admin/users/[id].js to use the shared `downgradeToFree()` helper instead of inline downgrade logic (verify existing behavior unchanged)
- [x] T005 Create api/stripe/index.js skeleton — consolidated handler with `export const config = { api: { bodyParser: false } }`, raw body reader helper function, route dispatcher (`_route` query param: checkout, portal, webhook), CORS handling, and proper method validation (POST only for all routes)

**Checkpoint**: Foundation ready — shared downgrade helper tested, stripe handler skeleton in place

---

## Phase 3: User Story 1 - Self-Service Pro Upgrade (Priority: P1) MVP

**Goal**: Free users can click "Upgrade to Pro — 5€/month" in Settings, complete payment via Stripe Checkout, and have their plan automatically upgraded to Pro via webhook.

**Independent Test**: Create a free account, click upgrade, complete payment with test card 4242424242424242, verify plan changes to Pro and Settings shows Pro status.

### Implementation for User Story 1

- [x] T006 [US1] Implement `_route=checkout` handler in api/stripe/index.js — verify JWT auth, check user is not already subscribed (plan='pro' with stripe_subscription_id), reuse stripe_customer_id if exists else use customer_email, create Stripe Checkout Session (mode: subscription, price: STRIPE_PRICE_ID, client_reference_id: userId, metadata: { user_id }, subscription_data.metadata: { user_id }), success_url: VITE_APP_URL/settings?checkout=success, cancel_url: VITE_APP_URL/settings?checkout=cancel, return { url }
- [x] T007 [US1] Implement `_route=webhook` handler for `checkout.session.completed` event in api/stripe/index.js — verify stripe-signature header via stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET), extract client_reference_id (userId), customer (stripe_customer_id), subscription (stripe_subscription_id), update profiles table: plan='pro', stripe_customer_id, stripe_subscription_id, plan_changed_at=now(), return { received: true }
- [x] T008 [US1] Update SettingsView.vue for free users — replace "Contact an admin to upgrade your account" text (line 272-273) with an "Upgrade to Pro — 5€/month" Button that: on click POSTs to /api/stripe/checkout with JWT auth, redirects to returned URL via window.location.href, shows loading state during API call
- [x] T009 [US1] Handle checkout return query params in SettingsView.vue — on mount, check route.query.checkout: if 'success' show success toast ("Welcome to Pro! Your account has been upgraded.") and call auth.fetchProfile() to refresh plan state, if 'cancel' show info toast ("Checkout canceled. You can upgrade anytime."), then clean query params from URL via router.replace

### Tests for User Story 1

- [x] T010 [US1] Write unit tests for checkout route handler in tests/unit/api/stripe.test.js — test: rejects non-POST, rejects missing auth, rejects already-subscribed user (plan='pro' with stripe_subscription_id), creates session with customer_email for new users, creates session with customer ID for returning users, returns { url }
- [x] T011 [US1] Write unit tests for checkout.session.completed webhook handler in tests/unit/api/stripe.test.js — test: rejects invalid signature, processes checkout.session.completed and updates profile to pro, handles missing client_reference_id gracefully

**Checkpoint**: Free → Pro upgrade flow is fully functional and testable independently

---

## Phase 4: User Story 2 - Subscription Self-Management (Priority: P2)

**Goal**: Pro users who subscribed via Stripe can click "Manage Subscription" in Settings to access Stripe's hosted billing portal for cancellation, payment updates, and invoice viewing.

**Independent Test**: Upgrade a user to Pro via Stripe, click "Manage Subscription", verify portal opens. Admin-promoted users should NOT see this button.

### Implementation for User Story 2

- [x] T012 [US2] Implement `_route=portal` handler in api/stripe/index.js — verify JWT auth, check user has stripe_customer_id (return 400 if null — admin-promoted user), create Stripe billingPortal session with customer: stripe_customer_id and return_url: VITE_APP_URL/settings, return { url }
- [x] T013 [US2] Update SettingsView.vue for Pro users — in the plan section (currently shows PlanComparison for Pro users), add "Manage Subscription" Button visible only when auth.profile?.stripe_customer_id is truthy, on click POST to /api/stripe/portal with JWT auth and redirect to returned URL, show loading state during API call
- [x] T014 [US2] Ensure admin-promoted Pro users (stripe_customer_id is null) see plan features but NOT the "Manage Subscription" button in SettingsView.vue

### Tests for User Story 2

- [x] T015 [US2] Write unit tests for portal route handler in tests/unit/api/stripe.test.js — test: rejects non-POST, rejects missing auth, rejects user without stripe_customer_id (400), creates portal session for user with stripe_customer_id, returns { url }

**Checkpoint**: Pro subscription management is functional. Admin-promoted users unaffected.

---

## Phase 5: User Story 3 - Automatic Plan Downgrade on Subscription End (Priority: P3)

**Goal**: When a subscription is canceled, payment fails, or subscription is deleted, the system automatically downgrades the user to Free and deactivates excess endpoints.

**Independent Test**: Cancel a Pro subscription via portal, verify plan downgrades to Free and excess endpoints are deactivated.

### Implementation for User Story 3

- [x] T016 [US3] Implement webhook handler for `customer.subscription.updated` in api/stripe/index.js — look up user by stripe_customer_id from event data, if subscription status is 'active' ensure plan='pro' (handles reactivation), if status is 'canceled', 'past_due', or 'unpaid' call downgradeToFree(userId) and clear stripe_subscription_id
- [x] T017 [US3] Implement webhook handler for `customer.subscription.deleted` in api/stripe/index.js — look up user by stripe_customer_id, call downgradeToFree(userId), clear stripe_subscription_id (retain stripe_customer_id for re-subscription)
- [x] T018 [US3] Implement webhook handler for `invoice.payment_failed` in api/stripe/index.js — log the event with user context (console.error), no plan change (subscription.updated handles state transitions)
- [x] T019 [US3] Add default case for unhandled webhook events in api/stripe/index.js — log event type, return 200 (never error on unknown events)
- [x] T019b [US3] Update account deletion flow to cancel Stripe subscription — in the account deletion handler (api/profile/index.js or src/composables/use-auth.js deleteAccount), if the user has a stripe_subscription_id, call stripe.subscriptions.cancel(stripe_subscription_id) before deleting the account to prevent orphaned billing

### Tests for User Story 3

- [x] T020 [P] [US3] Write unit tests for downgradeToFree() helper in tests/unit/api/plans.test.js — test: sets plan to 'free' and plan_changed_at, deactivates excess endpoints (most recently created first), returns correct endpointsDeactivated count, handles user with no excess endpoints (no deactivation), handles user already on free plan (idempotent)
- [x] T021 [US3] Write unit tests for subscription webhook handlers in tests/unit/api/stripe.test.js — test: subscription.updated with canceled status triggers downgrade, subscription.deleted triggers downgrade and clears stripe_subscription_id, subscription.updated with active status sets plan to pro, invoice.payment_failed is logged but no plan change, unhandled event types return 200, duplicate event processing is idempotent (processing checkout.session.completed twice doesn't create errors or duplicate updates, downgrading an already-free user is a no-op)

**Checkpoint**: All subscription lifecycle events handled. Downgrade with endpoint deactivation tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and validation

- [x] T022 Run `npm run test` to verify all existing + new tests pass
- [x] T023 Run `npm run lint` to verify no lint errors
- [x] T024 Run `npm run format:check` and fix any formatting issues via `npm run format`
- [x] T025 Run `npm run build` to verify production build succeeds
- [ ] T026 Validate quickstart.md scenarios can be manually tested with Stripe test mode

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — MVP, must complete first
- **US2 (Phase 4)**: Depends on Phase 2 — can run parallel to US1 but recommended after (shares api/stripe/index.js)
- **US3 (Phase 5)**: Depends on Phase 2 (uses downgradeToFree helper) — can run parallel to US1/US2 but recommended after US1 (shares api/stripe/index.js)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires foundational phase. Creates api/stripe/index.js and checkout + checkout.session.completed webhook. Independent.
- **US2 (P2)**: Requires foundational phase. Adds portal route to api/stripe/index.js. Recommended after US1 since they share the same file.
- **US3 (P3)**: Requires foundational phase (downgradeToFree helper). Adds subscription webhook handlers to api/stripe/index.js. Recommended after US1.

### Within Each User Story

- Implementation tasks are sequential (build on each other within same file)
- Tests can be written after implementation (not strict TDD) since this is a new feature integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T003 and T005 (Foundational) touch different files and can run in parallel
- T020 (downgradeToFree tests) can run in parallel with other US3 tasks since it tests a different file
- US1 tests (T010-T011) can be written in parallel with US1 implementation

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 (T006-T011)
4. **STOP and VALIDATE**: Test with Stripe test mode — free user can upgrade to Pro via checkout
5. Deploy to preview environment

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (checkout + webhook + UI) → Test → Deploy (MVP!)
3. Add US2 (portal + manage button) → Test → Deploy
4. Add US3 (downgrade webhooks) → Test → Deploy
5. Polish → Final validation → Production deploy

---

## Notes

- All 3 routes share api/stripe/index.js — sequential implementation within stories recommended
- `export const config = { api: { bodyParser: false } }` affects entire file — checkout/portal routes must manually JSON.parse raw body
- Stripe test mode cards: 4242424242424242 (success), 4000000000000341 (declined)
- Environment variables (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID) must be set in Vercel before deployment
- Local webhook testing requires Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
