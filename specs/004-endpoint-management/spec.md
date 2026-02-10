# Feature Specification: Endpoint Management

**Feature Branch**: `004-endpoint-management`
**Created**: 2026-02-09
**Status**: Draft
**Input**: CRUD operations for webhook endpoints with configuration

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Creates a Webhook Endpoint (Priority: P1)

An authenticated user creates a new webhook endpoint by providing a name and
forwarding configuration. The system generates a unique slug and displays the
full webhook URL that can be shared with external services.

**Why this priority**: Endpoints are the core entity — everything else depends on them.

**Independent Test**: Create an endpoint via the UI form, verify it appears in the
list with a copyable webhook URL.

**Acceptance Scenarios**:

1. **Given** I am on the endpoints page, **When** I click "New Endpoint", **Then** I am navigated to a dedicated creation page with the full endpoint form
2. **Given** I am on the creation page and fill in name, target URL, port, and path, **When** I submit the form, **Then** a new endpoint is created with an auto-generated slug and I am redirected to the endpoints list
3. **Given** I have created an endpoint, **When** I view the endpoints list, **Then** I see the endpoint with its name, full webhook URL, and status
4. **Given** an endpoint is displayed, **When** I click the copy button next to the webhook URL, **Then** the full URL is copied to my clipboard
5. **Given** I am creating an endpoint, **When** I leave the target URL empty, **Then** it defaults to `http://localhost`
6. **Given** I am creating an endpoint, **When** I leave the port empty, **Then** it defaults to `3000`
7. **Given** I have no endpoints, **When** I visit the endpoints page, **Then** I see an empty state message with a "Create your first endpoint" call-to-action button

---

### User Story 2 - User Edits an Endpoint (Priority: P1)

An authenticated user modifies an existing endpoint's configuration including
name, target URL, port, path, timeout, and custom headers.

**Why this priority**: Users need to update forwarding targets as their local setup changes.

**Independent Test**: Edit an endpoint's target port, save, and verify the change persists.

**Acceptance Scenarios**:

1. **Given** I have an endpoint, **When** I click edit and change the target port from 3000 to 8080, **Then** the change is saved and reflected in the UI
2. **Given** I am editing an endpoint, **When** I change the timeout to 45 seconds, **Then** the webhook receiver will wait 45 seconds for a response
3. **Given** I am editing an endpoint, **When** I set the timeout above 55, **Then** I see a validation error
4. **Given** I am editing an endpoint, **When** I set the timeout below 1, **Then** I see a validation error

---

### User Story 3 - User Configures Header Injection (Priority: P2)

An authenticated user adds custom headers that will be injected into every
forwarded request for a specific endpoint. This allows adding auth tokens
or custom identifiers that the local server requires.

**Why this priority**: Header injection is a value-added feature; core relay works without it.

**Independent Test**: Add a custom header `X-Api-Key: secret123` to an endpoint,
trigger a webhook, and verify the header is present in the forwarded request.

**Acceptance Scenarios**:

1. **Given** I am editing an endpoint, **When** I click "Add Header" and enter key `X-Api-Key` and value `secret123`, **Then** the custom header is saved
2. **Given** I have configured custom headers, **When** I add another row, **Then** both headers are saved
3. **Given** I have configured custom headers, **When** I click the remove button on a header row, **Then** that header is removed
4. **Given** I have an empty header key, **When** I try to save, **Then** I see a validation error
5. **Given** custom headers are configured, **When** a webhook is forwarded, **Then** the custom headers are added alongside the original headers

---

### User Story 4 - User Deletes an Endpoint (Priority: P1)

An authenticated user deletes an endpoint they no longer need. All associated
webhook logs are also deleted.

**Why this priority**: Users must be able to clean up unused endpoints.

**Independent Test**: Delete an endpoint and verify it disappears from the list and
its logs are also removed.

**Acceptance Scenarios**:

1. **Given** I have an endpoint, **When** I click delete and confirm, **Then** the endpoint is removed from the list
2. **Given** the endpoint had associated logs, **When** the endpoint is deleted, **Then** all associated logs are also deleted (CASCADE)
3. **Given** I click delete, **When** the confirmation dialog appears, **Then** I can cancel to keep the endpoint
4. **Given** I delete an endpoint, **When** another user has a different endpoint, **Then** the other user's data is unaffected

---

### User Story 5 - User Toggles Endpoint Active/Inactive (Priority: P2)

An authenticated user can quickly toggle an endpoint between active and inactive
states. Inactive endpoints reject incoming webhooks with a 404 response.

**Why this priority**: Useful for temporarily pausing webhooks without deleting the endpoint.

**Independent Test**: Toggle an endpoint to inactive, send a webhook, and verify it returns 404.

**Acceptance Scenarios**:

1. **Given** an active endpoint, **When** I toggle the active switch, **Then** the endpoint becomes inactive and the UI reflects this
2. **Given** an inactive endpoint, **When** a webhook is sent to its URL, **Then** the sender receives a 404 response
3. **Given** an inactive endpoint, **When** I toggle the active switch again, **Then** the endpoint becomes active and accepts webhooks

---

### Edge Cases

- What happens when two users create endpoints at the same time? UUID-based slugs prevent collisions
- What happens when the user tries to edit an endpoint that was just deleted? API returns 404, UI shows an error notification
- What happens with a very long custom header value? No validation limit; database text type handles it
- Is there a maximum number of endpoints per user? No limit; endpoint count is naturally self-limiting for a developer tool

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an API to list all endpoints for the authenticated user
- **FR-002**: System MUST provide an API to create a new endpoint with auto-generated slug (8-char hex from UUID)
- **FR-003**: System MUST provide an API to update an existing endpoint (only if owned by the authenticated user)
- **FR-004**: System MUST provide an API to delete an endpoint (only if owned by the authenticated user)
- **FR-005**: System MUST provide an endpoints list view displaying all user's endpoints as cards
- **FR-006**: System MUST provide an endpoint detail/edit view with a form for all configurable fields
- **FR-013**: The "New Endpoint" action MUST navigate to a dedicated creation page that reuses the same form as the edit view
- **FR-007**: Each endpoint card MUST display: name, webhook URL (with copy button), active/inactive status, target configuration summary, last activity timestamp
- **FR-008**: The endpoint form MUST include fields: name (text), target URL (text, default `http://localhost`), target port (number, default 3000), target path (text, default `/`), timeout (number, range 1-55, default 30)
- **FR-009**: The endpoint form MUST include a header injection editor — a dynamic list of key-value pairs with add/remove controls
- **FR-010**: System MUST validate: name is not empty, port is between 1 and 65535, timeout is between 1 and 55, header keys are not empty
- **FR-011**: System MUST implement a client-side store for endpoint state management
- **FR-012**: Delete MUST show a confirmation dialog before proceeding
- **FR-014**: The endpoints list MUST display an empty state with a call-to-action button when the user has no endpoints

### Key Entities

- **Endpoint**: id, user_id, name, slug, target_url, target_port, target_path, timeout_seconds, custom_headers, is_active, created_at, updated_at

## Clarifications

### Session 2026-02-09

- Q: How should the "New Endpoint" creation flow work? → A: Dedicated page at `/endpoints/new` with the full form (reuses edit form component)
- Q: What should the endpoints list show when the user has no endpoints? → A: Empty state with a call-to-action message and "Create your first endpoint" button
- Q: Should there be a maximum number of endpoints per user? → A: No limit; naturally self-limiting for a developer tool

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create, read, update, and delete endpoints without errors
- **SC-002**: Webhook URLs are unique and copyable to clipboard
- **SC-003**: Custom headers are persisted and correctly forwarded (verified in relay spec)
- **SC-004**: Inactive endpoints return 404 to webhook senders
- **SC-005**: All form validations prevent invalid data from being submitted
