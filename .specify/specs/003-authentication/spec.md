# Feature Specification: Authentication

**Feature Branch**: `003-authentication`
**Created**: 2026-02-09
**Status**: Draft
**Input**: User authentication requirements using Supabase Auth

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Registers an Account (Priority: P1)

A new user visits HookSpy and creates an account using their email and password.
After registration, they are redirected to the dashboard.

**Why this priority**: Users must authenticate before they can create endpoints or view logs.

**Independent Test**: Navigate to the register page, fill in email and password,
submit, and verify the user is authenticated and redirected to the dashboard.

**Acceptance Scenarios**:

1. **Given** I am on the register page, **When** I enter a valid email and password (min 6 chars) and submit, **Then** my account is created and I am redirected to the dashboard
2. **Given** I am on the register page, **When** I enter an email that is already registered, **Then** I see an error message "This email is already registered"
3. **Given** I am on the register page, **When** I enter a password shorter than 6 characters, **Then** I see a validation error before submission
4. **Given** I am on the register page, **When** I enter a password and a non-matching confirmation, **Then** I see a validation error "Passwords do not match"

---

### User Story 2 - User Logs In (Priority: P1)

An existing user visits HookSpy and logs in with their email and password.
After login, they are redirected to the dashboard.

**Why this priority**: Login is the primary authentication flow.

**Independent Test**: Navigate to the login page, enter valid credentials, submit,
and verify redirection to the dashboard with authenticated state.

**Acceptance Scenarios**:

1. **Given** I am on the login page, **When** I enter valid credentials and submit, **Then** I am logged in and redirected to the dashboard
2. **Given** I am on the login page, **When** I enter invalid credentials, **Then** I see an error message "Invalid email or password"
3. **Given** I am on the login page, **When** I click "Create an account", **Then** I am navigated to the register page
4. **Given** I am already logged in, **When** I navigate to `/login`, **Then** I am redirected to the dashboard

---

### User Story 3 - User Logs Out (Priority: P1)

An authenticated user clicks the logout button and their session is ended.
They are redirected to the login page.

**Why this priority**: Logout is essential for account security.

**Independent Test**: While logged in, click logout and verify the session is
cleared and all routes redirect to login.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I click the logout button in the header, **Then** my session is cleared and I am redirected to the login page
2. **Given** I have logged out, **When** I navigate to any protected route, **Then** I am redirected to the login page
3. **Given** I have logged out, **When** I use the browser back button, **Then** I am still redirected to the login page (no cached state)

---

### User Story 4 - Session Persistence (Priority: P2)

An authenticated user closes the browser and reopens HookSpy. Their session
is automatically restored without requiring re-authentication.

**Why this priority**: Session persistence prevents friction but is not blocking for core features.

**Independent Test**: Log in, close the tab, reopen HookSpy, and verify the user
is still authenticated.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I close and reopen the browser, **Then** my session is restored and I see the dashboard
2. **Given** my session token has expired, **When** Supabase refreshes it, **Then** my session continues seamlessly
3. **Given** I am not logged in, **When** I navigate to the root URL, **Then** I am redirected to the login page

---

### Edge Cases

- What happens when Supabase Auth is unreachable? Show a connection error toast
- What happens when the JWT token expires during an API call? The Supabase client auto-refreshes; if that fails, redirect to login
- What happens when two tabs are open and one logs out? Both should reflect the logged-out state

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use Supabase Auth with email/password provider
- **FR-002**: System MUST provide a registration page at `/register` with fields: email, password, confirm password
- **FR-003**: System MUST provide a login page at `/login` with fields: email, password
- **FR-004**: System MUST implement a Pinia auth store (`stores/auth.js`) that manages: current user, session state, login/register/logout actions, session initialization on app load
- **FR-005**: System MUST implement a `useAuth` composable that provides reactive access to the auth store
- **FR-006**: System MUST implement Vue Router navigation guards that redirect unauthenticated users to `/login` for all routes except `/login` and `/register`
- **FR-007**: System MUST pass the Supabase JWT in the `Authorization: Bearer <token>` header for all API calls to serverless functions
- **FR-008**: System MUST implement a server-side auth helper (`api/_lib/auth.js`) that extracts and verifies the JWT from the Authorization header using the Supabase client
- **FR-009**: System MUST display a user indicator in the app header showing the logged-in email and a logout button
- **FR-010**: System MUST handle auth errors gracefully with PrimeVue Toast notifications
- **FR-011**: Login and register pages MUST use PrimeVue form components (InputText, Password, Button)

### Key Entities

- **User**: Managed by Supabase Auth (auth.users table). Fields: id, email, created_at
- **Session**: Managed by Supabase client. Contains access_token (JWT) and refresh_token

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can register, log in, and log out without errors
- **SC-002**: Protected routes are inaccessible to unauthenticated users in 100% of test cases
- **SC-003**: Session persists across browser restarts
- **SC-004**: API calls include a valid JWT that the serverless function can verify
- **SC-005**: Auth-related errors display user-friendly messages via toast notifications
