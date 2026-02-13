# API Contracts: Dashboard

## Overview

The dashboard feature requires **no new API endpoints**. All data is sourced from existing endpoints with specific query parameters.

## Existing Endpoints Used

### GET /api/logs — Recent Activity Feed

Fetches the 10 most recent logs across all user endpoints.

**Request**:

```
GET /api/logs?limit=10&page=1
Authorization: Bearer <jwt>
```

**Response** (200):

```json
{
  "data": [
    {
      "id": "uuid",
      "endpoint_id": "uuid",
      "endpoint_name": "My Webhook",
      "endpoint_slug": "a1b2c3d4",
      "status": "responded",
      "request_method": "POST",
      "request_url": "/hook/a1b2c3d4",
      "request_headers": {},
      "request_body": "...",
      "response_status": 200,
      "response_headers": {},
      "response_body": "...",
      "error_message": null,
      "duration_ms": 150,
      "received_at": "2026-02-12T10:30:00Z",
      "responded_at": "2026-02-12T10:30:00.150Z",
      "replayed_from": null
    }
  ],
  "total": 47
}
```

### GET /api/logs — 24h Request Count

Fetches only the count of logs in the last 24 hours.

**Request**:

```
GET /api/logs?limit=1&from=2026-02-11T10:30:00Z
Authorization: Bearer <jwt>
```

**Response** (200):

```json
{
  "data": [ ... ],
  "total": 15
}
```

Only the `total` field is used — the single data item is discarded.

### GET /api/endpoints — Endpoint List

Already fetched by the endpoints store on app initialization. No additional API call needed.

**Response shape** (from store):

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Webhook",
      "slug": "a1b2c3d4",
      "target_url": "http://localhost",
      "target_port": 3000,
      "target_path": "/webhook",
      "timeout_seconds": 30,
      "custom_headers": {},
      "is_active": true,
      "created_at": "2026-02-10T00:00:00Z",
      "updated_at": "2026-02-12T10:30:00Z"
    }
  ]
}
```

### PUT /api/endpoints/:id — Toggle Active (Quick Action)

Used by the endpoint toggle switch on the dashboard.

**Request**:

```
PUT /api/endpoints/<id>
Authorization: Bearer <jwt>
Content-Type: application/json

{ "is_active": false }
```

**Response** (200):

```json
{
  "data": {
    "id": "uuid",
    "is_active": false,
    ...
  }
}
```

Already implemented via `endpoints.toggleActive(id)` in the endpoints store.
