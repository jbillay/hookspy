# API Contract: Placeholder Webhook Endpoint

**Feature**: 001-project-scaffolding
**Date**: 2026-02-09

## Overview

A minimal placeholder serverless function to validate that Vercel routing
is correctly configured. This endpoint will be replaced with the full webhook
receiver implementation in feature `005-webhook-receiver`.

## Endpoint

**Path**: `/api/hook/:slug`
**Method**: All HTTP methods (GET, POST, PUT, PATCH, DELETE)
**Authentication**: None (placeholder only)

## Request

| Parameter | Location | Type   | Required | Description                 |
| --------- | -------- | ------ | -------- | --------------------------- |
| slug      | Path     | string | Yes      | Webhook endpoint identifier |

Any request body and headers are accepted but not processed.

## Response

**Status**: `200 OK`
**Content-Type**: `application/json`

```json
{
  "status": "ok",
  "message": "HookSpy webhook endpoint placeholder",
  "slug": ":slug",
  "method": "POST",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

## Notes

- This placeholder exists solely to verify Vercel serverless function routing
  works correctly (FR-013).
- No authentication, validation, or database interaction is performed.
- The response echoes the slug and HTTP method for debugging purposes.
- CORS headers are not configured in this placeholder; they will be added in
  feature `005-webhook-receiver`.
