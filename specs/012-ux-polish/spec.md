# Feature Specification: UX Polish & Improvements

**Feature Branch**: `012-ux-polish`
**Created**: 2026-03-02
**Status**: Draft
**Input**: Comprehensive UX review of hookspy.dev covering landing page, registration, dashboard, endpoint management, logs, settings, Stripe upgrade, dark mode, and mobile responsiveness. 34 issues identified across P1-P3 severity levels (P0 bugs already fixed).

## Clarifications

### Session 2026-03-02

- Q: What form should the onboarding guide take? → A: Full-screen guided tour overlay with step-by-step highlights
- Q: Where should onboarding state be stored? → A: Server-side (new field on profiles table) — persists across devices and browsers

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Settings Page Loads Reliably (Priority: P1)

A user navigates to the Settings page from any other page in the app and sees their account settings, plan information, and upgrade options immediately — without needing to reload the page.

**Why this priority**: The Settings page is completely blank on first SPA navigation. This blocks access to profile management, password changes, and the Stripe upgrade flow (revenue path).

**Independent Test**: Navigate from Dashboard to Settings via the nav link and verify all sections render without a page reload.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Dashboard, **When** they click "Settings" in the nav, **Then** the Settings page renders all sections (Profile, Security, Your Plan, Upgrade, Danger Zone) within 2 seconds.
2. **Given** a logged-in user on the Endpoints page, **When** they click "Settings" in the nav, **Then** the page content is visible without requiring a manual reload.
3. **Given** a user who directly navigates to `/settings` via URL, **When** the page loads, **Then** all sections render correctly on the first load.

---

### User Story 2 - Accurate and Consistent Pricing Information (Priority: P1)

A prospective user visits the landing page and sees pricing and plan limits that exactly match what they will experience inside the app. The Pro plan card shows the actual price and features available today.

**Why this priority**: Pricing inconsistency between the landing page and the app erodes trust and may cause users to feel misled. The Pro card says "TBD / Coming soon" despite Pro being live at 5 EUR/month.

**Independent Test**: Compare all plan details shown on the landing page pricing section against the Settings page plan comparison table and verify they match.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they scroll to the pricing section, **Then** the Free plan card shows "3 endpoints" and "6-hour log retention" (matching actual limits).
2. **Given** a visitor on the landing page, **When** they view the Pro plan card, **Then** it shows "5 EUR/month" with the actual feature list (25 endpoints, 7-day retention, replay, search, custom headers).
3. **Given** a visitor on the landing page, **When** they click the Pro plan CTA, **Then** they are directed to register or sign in (not shown a disabled "Coming soon" button).
4. **Given** a logged-in user on the Settings page, **When** they compare plan details with the landing page, **Then** all limits and features match exactly.

---

### User Story 3 - Endpoint Limit Visibility and Upgrade Path (Priority: P1)

A Free plan user clearly understands their endpoint limit, sees how many they have used, and has a direct path to upgrade when they approach or reach the limit.

**Why this priority**: The "1/3" progress bar on the Endpoints page has no context. Users do not understand what the limit means or how to get more endpoints.

**Independent Test**: Create 3 endpoints on a Free plan and verify the limit is explained and an upgrade CTA appears.

**Acceptance Scenarios**:

1. **Given** a Free user on the Endpoints page with 1/3 endpoints, **When** they view the progress bar, **Then** they see explanatory text such as "Free plan: 3 endpoints" with an "Upgrade to Pro" link.
2. **Given** a Free user who has reached 3/3 endpoints, **When** they try to create a new endpoint, **Then** they see a clear message explaining the limit and a prominent upgrade button.
3. **Given** a Pro user on the Endpoints page, **When** they view the progress bar, **Then** it reflects the Pro limit (25 endpoints).

---

### User Story 4 - Landing Page Navigation and CTAs Work Correctly (Priority: P2)

A visitor to the landing page can navigate using all links, buttons, and anchor links. CTA buttons lead to registration or the sign-in form. The logo on auth pages links back to the landing page.

**Why this priority**: Multiple navigation elements on the landing page are non-functional, creating a broken first impression and reducing conversion.

**Independent Test**: Click every CTA button and nav link on the landing page and verify each navigates or scrolls to the correct destination.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they click "Start for free", **Then** they are navigated to the registration page or scrolled to the sign-in form.
2. **Given** a visitor on the landing page, **When** they click "How it works" in the nav, **Then** the page scrolls to the "How it works" section.
3. **Given** a visitor on the landing page, **When** they click "Features" or "Pricing" in the nav, **Then** the page scrolls to the corresponding section.
4. **Given** a user on the login or register page, **When** they click the HookSpy logo, **Then** they are navigated back to the landing page.

---

### User Story 5 - New User Onboarding After First Endpoint (Priority: P2)

After creating their first endpoint, a new user sees a full-screen guided tour overlay that walks them through the key next steps — copying the webhook URL, pasting it in a provider, keeping the dashboard open, and sending a test webhook. The tour highlights relevant UI elements step by step.

**Why this priority**: After endpoint creation, users are left without guidance. A guided tour reduces time-to-value and increases retention by walking users through their first successful webhook relay.

**Independent Test**: Create a new account, create an endpoint, and verify that a full-screen guided tour overlay appears on the dashboard, highlighting UI elements step by step.

**Acceptance Scenarios**:

1. **Given** a new user who just created their first endpoint, **When** they return to the dashboard, **Then** a full-screen guided tour overlay appears with step-by-step highlights: (1) copy webhook URL, (2) paste in webhook provider, (3) keep dashboard open, (4) send a test webhook.
2. **Given** a user progressing through the guided tour, **When** they complete or dismiss the tour, **Then** the overlay closes and does not reappear (onboarding state persisted server-side).
3. **Given** a user who has already completed the tour, **When** they log in from a different device, **Then** the tour does not appear again (state stored in their profile).

---

### User Story 6 - Destructive Actions Require Confirmation (Priority: P2)

Users are protected from accidental destructive actions. Deleting an endpoint requires a confirmation dialog. Deleting an account requires typing a confirmation phrase.

**Why this priority**: Delete buttons are near other actions with no safety net. Accidental deletion causes data loss.

**Independent Test**: Click Delete on an endpoint and verify a confirmation modal appears. Click Delete Account and verify a double-confirmation is required.

**Acceptance Scenarios**:

1. **Given** a user on the Endpoints page, **When** they click "Delete" on an endpoint, **Then** a confirmation modal appears showing the endpoint name and warning that the action cannot be undone.
2. **Given** a user viewing the delete confirmation modal, **When** they click "Cancel", **Then** the endpoint is not deleted and the modal closes.
3. **Given** a user on the Settings page, **When** they click "Delete Account", **Then** a modal appears requiring them to type "DELETE" or their email to confirm.
4. **Given** a user in the delete account modal, **When** they type the wrong confirmation text, **Then** the delete button remains disabled.

---

### User Story 7 - Registration and Auth UX Improvements (Priority: P2)

Users see password requirements before submitting, receive user-friendly error messages, and have access to a "Forgot password" flow.

**Why this priority**: Users currently get no guidance on password requirements and see raw backend errors.

**Independent Test**: Visit the registration page and verify password hints are shown. Submit an invalid form and verify error messages are user-friendly.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration page, **When** they focus on the password field, **Then** they see password requirements (minimum length, etc.) as helper text.
2. **Given** a visitor who submits registration with an already-used email, **When** the server returns an error, **Then** the user sees "This email is already registered" (not a raw database error).
3. **Given** a user on the login page, **When** they cannot remember their password, **Then** they see a "Forgot password?" link that initiates a password reset flow.

---

### User Story 8 - Form Feedback and Input Polish (Priority: P2)

Users receive clear feedback when saving settings, password fields indicate why they are disabled, and form inputs display values in appropriate formats.

**Why this priority**: Multiple forms lack feedback (no save confirmation, unexplained disabled states, locale-formatted port numbers).

**Independent Test**: Save a profile display name and verify a success toast appears. Check that port fields show raw numbers without thousand separators.

**Acceptance Scenarios**:

1. **Given** a user on the Settings page who updates their display name, **When** they click "Save", **Then** a success toast notification appears confirming the change.
2. **Given** a user on the Settings page who has not filled in all password fields, **When** they view the Change Password button, **Then** they see helper text explaining what is needed.
3. **Given** a user on the Settings page, **When** they view the disabled email field, **Then** helper text explains "Email cannot be changed."
4. **Given** a user creating or editing an endpoint, **When** they view the port field, **Then** the port number is displayed without thousand separators (e.g., "3000" not "3,000").

---

### User Story 9 - Connection Status and Log Empty States (Priority: P2)

Users see accurate connection status indicators and helpful empty states throughout the app.

**Why this priority**: "Disconnected" flashes on every page load before WebSocket connects, causing unnecessary alarm. Empty log pages provide no guidance.

**Independent Test**: Load the dashboard and verify the status shows "Connecting..." before switching to "Connected". Visit the Logs page with no data and verify helpful guidance is shown.

**Acceptance Scenarios**:

1. **Given** a logged-in user loading any authenticated page, **When** the WebSocket is initializing, **Then** the status indicator shows "Connecting..." (not "Disconnected").
2. **Given** a user on the Logs page with no webhook logs, **When** they view the empty state, **Then** they see guidance text explaining how logs will appear and a sample curl command to test their endpoint.
3. **Given** a Free user viewing the Logs page, **When** the retention banner is shown, **Then** the retention period matches the actual Free plan limit (consistent with landing page and Settings).

---

### User Story 10 - Mobile Experience Improvements (Priority: P2)

Mobile users can access all navigation, see their user info, view full webhook URLs, and navigate the landing page.

**Why this priority**: Multiple mobile-specific issues reduce usability on smaller screens.

**Independent Test**: Open the app on a mobile viewport and verify all mobile-specific improvements.

**Acceptance Scenarios**:

1. **Given** a mobile user viewing an endpoint, **When** the webhook URL is too long for the screen, **Then** they can scroll horizontally or tap to reveal the full URL.
2. **Given** a mobile user who opens the hamburger menu, **When** the menu is visible, **Then** it shows their email and plan badge alongside nav links.
3. **Given** a mobile visitor on the landing page, **When** they look for navigation, **Then** a hamburger menu is available with links to How it works, Features, Pricing, and Sign in.

---

### User Story 11 - Dashboard and UI Polish (Priority: P3)

Various small polish items improve the overall feel: endpoint names are clickable, duplicate endpoint action is available, Pro filter tooltips guide upgrade, and dark mode persists across sessions.

**Why this priority**: These are low-severity polish items that improve the overall quality but do not block any core flow.

**Independent Test**: Verify each individual polish item independently.

**Acceptance Scenarios**:

1. **Given** a user on the Dashboard, **When** they view an endpoint card, **Then** the endpoint name is a clickable link to the endpoint detail page.
2. **Given** a user on the Endpoints page, **When** they view an endpoint's actions, **Then** a "Duplicate" option is available alongside Edit and Delete.
3. **Given** a Free user on the Logs page, **When** they click a Pro-only filter (Search, Method), **Then** a tooltip or popover appears saying "Upgrade to Pro to use this filter."
4. **Given** a user who enables dark mode, **When** they close and reopen the browser, **Then** dark mode is still active (persisted via localStorage).

---

### Edge Cases

- What happens when a Free user hits the endpoint limit and tries to create a new one via the API directly (bypassing the UI)?
- How does the onboarding guide behave if the user creates an endpoint, deletes it, then creates another?
- What happens when the WebSocket connection fails entirely (not just slow to connect)?
- What if a user types part of the confirmation phrase for account deletion and then refreshes?
- How does dark mode behave when system preferences conflict with the stored localStorage preference?

## Requirements _(mandatory)_

### Functional Requirements

**P1 — High Priority**

- **FR-001**: System MUST render the Settings page content on SPA navigation without requiring a page reload.
- **FR-002**: Landing page MUST display Free plan limits (3 endpoints, 6-hour retention) that match the actual enforced limits.
- **FR-003**: Landing page MUST display Pro plan pricing (5 EUR/month) and features matching the actual Pro plan.
- **FR-004**: Landing page Pro plan CTA MUST link to registration or sign-in (not display a disabled button).
- **FR-005**: Endpoint usage indicator MUST include explanatory text about plan limits and an upgrade link for Free users.
- **FR-006**: System MUST show a clear upgrade path when a Free user reaches their endpoint limit.

**P2 — Medium Priority**

- **FR-007**: All CTA buttons on the landing page MUST navigate to registration or scroll to the sign-in form.
- **FR-008**: Landing page anchor links (How it works, Features, Pricing) MUST scroll to the correct section.
- **FR-009**: HookSpy logo on login and register pages MUST link back to the landing page.
- **FR-010**: System MUST show a "Connecting..." state during WebSocket initialization instead of "Disconnected."
- **FR-011**: Dashboard MUST display a full-screen guided tour overlay after a user creates their first endpoint. The tour MUST highlight UI elements step by step and persist completion state server-side (profiles table) so it does not reappear on other devices.
- **FR-012**: Endpoint deletion MUST require user confirmation via a modal dialog.
- **FR-013**: Account deletion MUST require a double-confirmation (typing "DELETE" or email).
- **FR-014**: Registration page MUST display password requirements as helper text.
- **FR-015**: Error messages shown to users MUST be user-friendly (no raw database or server errors).
- **FR-016**: Profile save action MUST show a success or error toast notification.
- **FR-017**: Change Password button MUST show helper text explaining why it is disabled.
- **FR-018**: Port number input MUST display without locale-specific thousand separators.
- **FR-019**: Webhook log empty state MUST include guidance text and an example command.
- **FR-020**: Log retention messaging MUST be consistent across landing page, logs page, and settings page.
- **FR-021**: Mobile webhook URLs MUST be viewable in full (scrollable or expandable).
- **FR-022**: Mobile hamburger menu MUST display user email and plan badge.
- **FR-023**: Landing page on mobile MUST include a hamburger menu with navigation links.

**P3 — Low Priority**

- **FR-024**: Dashboard endpoint card names MUST be clickable links to the endpoint detail page.
- **FR-025**: Endpoint actions MUST include a "Duplicate" option.
- **FR-026**: Pro-only filters on the Logs page MUST show an upgrade tooltip when clicked by Free users.
- **FR-027**: Disabled email field on Settings MUST include explanatory helper text.
- **FR-028**: Login pages MUST include a "Forgot password?" link.
- **FR-029**: Dark mode preference MUST persist across browser sessions via localStorage.

### Key Entities

- **Plan Configuration**: Defines limits per plan (endpoints, retention, rate limits, body size, timeout). Single source of truth for all plan-related messaging across the app.
- **Onboarding State**: Stored as a field on the profiles table. Tracks whether a user has completed the first-use guided tour. Set to complete when the user finishes or dismisses the tour. Persists across devices and browsers.
- **User Preferences**: Stores user-level settings such as dark mode preference.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Settings page renders fully on SPA navigation 100% of the time (zero blank-page occurrences).
- **SC-002**: All plan limits displayed across the app (landing page, endpoints page, logs page, settings page) are identical — zero inconsistencies.
- **SC-003**: 100% of landing page CTA buttons and anchor links navigate to their intended destination.
- **SC-004**: New users who create their first endpoint see onboarding guidance within 1 second of endpoint creation.
- **SC-005**: Destructive actions (endpoint deletion, account deletion) require explicit user confirmation before executing.
- **SC-006**: All form actions (save profile, change password) provide visible success or error feedback within 1 second.
- **SC-007**: Mobile users can access all navigation items, view full webhook URLs, and see their account information.
- **SC-008**: 90% of user-facing error messages are human-readable (no raw technical errors).
- **SC-009**: Dark mode preference persists across browser sessions for 100% of users.

## Assumptions

- The actual enforced plan limits are: Free = 3 endpoints, 6-hour retention, 30 req/min; Pro = 25 endpoints, 7-day retention, 120 req/min. These are the source of truth.
- Email confirmation is not currently enforced by Supabase configuration. The recommendation is to keep it disabled for now and add a note on the registration form.
- "Forgot password" will use Supabase's built-in password reset flow (magic link via email).
- The onboarding tour is a full-screen guided overlay with step-by-step highlights. It is dismissed when the user completes or manually closes it. Completion state is stored server-side on the profiles table.
- The Settings page blank issue is a client-side data-loading race condition, not a backend issue.
- Dark mode is currently toggled via PrimeVue's theme system and may already use localStorage — verification needed.
