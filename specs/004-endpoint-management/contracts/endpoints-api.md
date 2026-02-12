# API Contract: Endpoints

**Base URL**: `/api/endpoints`
**Auth**: All endpoints require `Authorization: Bearer <token>` header.

## GET /api/endpoints

List all endpoints for the authenticated user.

**Response 200**:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Webhook",
      "slug": "a1b2c3d4",
      "target_url": "http://localhost",
      "target_port": 3000,
      "target_path": "/webhooks",
      "timeout_seconds": 30,
      "custom_headers": { "X-Api-Key": "secret" },
      "is_active": true,
      "created_at": "2026-02-09T00:00:00Z",
      "updated_at": "2026-02-09T00:00:00Z"
    }
  ]
}
```

**Response 401**: `{ "error": "Missing or invalid Authorization header" }`

## POST /api/endpoints

Create a new endpoint.

**Request Body**:

```json
{
  "name": "My Webhook",
  "target_url": "http://localhost",
  "target_port": 3000,
  "target_path": "/webhooks",
  "timeout_seconds": 30,
  "custom_headers": {}
}
```

All fields except `name` are optional (defaults apply).

**Response 201**:

```json
{
  "data": {
    "id": "uuid",
    "name": "My Webhook",
    "slug": "a1b2c3d4",
    "target_url": "http://localhost",
    "target_port": 3000,
    "target_path": "/webhooks",
    "timeout_seconds": 30,
    "custom_headers": {},
    "is_active": true,
    "created_at": "2026-02-09T00:00:00Z",
    "updated_at": "2026-02-09T00:00:00Z"
  }
}
```

**Response 400**: `{ "error": "Name is required" }`
**Response 401**: `{ "error": "Missing or invalid Authorization header" }`

## GET /api/endpoints/:id

Get a single endpoint by ID.

**Response 200**: `{ "data": { ...endpoint } }`
**Response 401**: `{ "error": "Missing or invalid Authorization header" }`
**Response 404**: `{ "error": "Endpoint not found" }`

## PUT /api/endpoints/:id

Update an existing endpoint.

**Request Body** (partial update — only include fields to change):

```json
{
  "name": "Updated Name",
  "target_port": 8080,
  "timeout_seconds": 45,
  "custom_headers": { "X-Api-Key": "new-secret" },
  "is_active": false
}
```

**Response 200**: `{ "data": { ...updatedEndpoint } }`
**Response 400**: `{ "error": "Port must be between 1 and 65535" }`
**Response 401**: `{ "error": "Missing or invalid Authorization header" }`
**Response 404**: `{ "error": "Endpoint not found" }`

## DELETE /api/endpoints/:id

Delete an endpoint and all associated webhook logs (CASCADE).

**Response 200**: `{ "message": "Endpoint deleted" }`
**Response 401**: `{ "error": "Missing or invalid Authorization header" }`
**Response 404**: `{ "error": "Endpoint not found" }`

## OPTIONS /api/endpoints, OPTIONS /api/endpoints/:id

CORS preflight.

**Response 200**: Empty body with CORS headers.

## Error Response Format

All errors follow:

```json
{
  "error": "Human-readable error message"
}
```

## CORS Headers

Applied to all responses:

```
Access-Control-Allow-Origin: <VITE_APP_URL or *>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```
