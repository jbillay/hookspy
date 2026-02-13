# Data Model: Dashboard

## Overview

The dashboard feature requires **no new database tables or columns**. All data is derived from existing tables (`endpoints`, `webhook_logs`) via existing API endpoints and Supabase Realtime subscriptions.

## Computed Data Structures (Client-Side)

### Dashboard Summary

Derived from the endpoints store and a single logs API call:

```
DashboardSummary {
  totalEndpoints: number       // endpoints.length
  activeEndpoints: number      // endpoints.filter(e => e.is_active).length
  inactiveEndpoints: number    // endpoints.filter(e => !e.is_active).length
  requestCount24h: number      // from GET /api/logs?limit=1&from=<24h-ago> → total
}
```

### Activity Feed Entry

Derived from the logs API response (already includes endpoint name via join):

```
ActivityEntry {
  id: string                   // webhook_logs.id
  endpoint_name: string        // joined from endpoints.name
  request_method: string       // GET, POST, PUT, etc.
  status: string               // pending | forwarding | responded | timeout | error
  received_at: timestamp       // when the webhook was received
  timeAgo: string              // computed client-side ("2 min ago")
}
```

### Endpoint Quick Card

Uses the existing endpoint object from the endpoints store:

```
EndpointQuickCard {
  id: string                   // endpoints.id
  name: string                 // endpoints.name
  slug: string                 // endpoints.slug (for building webhook URL)
  is_active: boolean           // endpoints.is_active
  target_url: string           // endpoints.target_url
  target_port: number          // endpoints.target_port
  target_path: string          // endpoints.target_path
  updated_at: timestamp        // endpoints.updated_at (for "last activity")
}
```

## State Management

### New: Dashboard composable (`use-dashboard.js`)

Manages dashboard-specific state without polluting existing stores:

```
State:
  recentLogs: ref([])          // Last 10 logs for activity feed
  requestCount24h: ref(0)      // 24h request count
  loadingStats: ref(false)     // Loading state for stats fetch
  channel: ref(null)           // Realtime subscription channel

Computed:
  totalEndpoints               // from endpoints store
  activeEndpoints              // from endpoints store
  inactiveEndpoints            // from endpoints store
  hasEndpoints                 // totalEndpoints > 0

Actions:
  fetchStats()                 // Fetch 24h count + recent logs
  startSubscription()          // Subscribe to Realtime for activity feed
  stopSubscription()           // Unsubscribe from Realtime
```

## Realtime Subscription

Channel: `dashboard-activity`
Table: `webhook_logs`
Events: INSERT, UPDATE
Filter: `endpoint_id=in.(id1,id2,...)`

On INSERT: prepend to `recentLogs`, trim to 10 entries
On UPDATE: update matching entry in `recentLogs` (status changes)

## Existing API Usage

| API Call                               | Purpose                                | Notes                              |
| -------------------------------------- | -------------------------------------- | ---------------------------------- |
| `GET /api/logs?limit=10`               | Fetch recent 10 logs for activity feed | No endpoint filter — all endpoints |
| `GET /api/logs?limit=1&from=<24h-ago>` | Get 24h request count via `total`      | Only need the count, not the data  |
| Endpoints store `.fetchEndpoints()`    | Get all endpoints for summary stats    | Already called on app init         |
