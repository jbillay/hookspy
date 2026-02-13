# Data Model: Replay & Search

## Database Changes

### Migration: Add `replayed_from` column

**Table**: `webhook_logs`

| Column        | Type | Nullable | Default | FK                                  | Description                                        |
| ------------- | ---- | -------- | ------- | ----------------------------------- | -------------------------------------------------- |
| replayed_from | uuid | YES      | null    | webhook_logs(id) ON DELETE SET NULL | References the original log this was replayed from |

**Notes**:

- ON DELETE SET NULL: if the original log is deleted (24h cleanup), the replay still exists but loses its lineage reference
- No index needed — we never query "find all replays of log X" at scale
- RLS policy already covers this column (inherits from existing webhook_logs policies)

### No New Indexes Required for Filtering

The existing index `idx_webhook_logs_endpoint_received ON (endpoint_id, received_at DESC)` covers the primary query pattern. Additional indexes on `status` or `request_method` are not justified given:

- 24-hour retention limits data volume
- Typical user has < 1000 logs
- `ILIKE` search on text columns doesn't benefit from B-tree indexes

## Store State Changes

### Logs Store (`src/stores/logs.js`)

**New state refs**:

| Ref          | Type      | Default | Description                                      |
| ------------ | --------- | ------- | ------------------------------------------------ |
| methodFilter | Array     | []      | Selected HTTP methods (e.g., ['GET', 'POST'])    |
| statusFilter | Array     | []      | Selected statuses (e.g., ['responded', 'error']) |
| searchQuery  | String    | ''      | Text search term                                 |
| dateFrom     | Date/null | null    | Start of date range                              |
| dateTo       | Date/null | null    | End of date range                                |

**New actions**:

| Action                    | Parameters           | Description                               |
| ------------------------- | -------------------- | ----------------------------------------- |
| setMethodFilter(methods)  | Array of strings     | Update method filter, reset page, refetch |
| setStatusFilter(statuses) | Array of strings     | Update status filter, reset page, refetch |
| setSearchQuery(query)     | String               | Update search text, reset page, refetch   |
| setDateRange(from, to)    | Date/null, Date/null | Update date range, reset page, refetch    |
| clearAllFilters()         | none                 | Reset all filters, reset page, refetch    |
| replayLog(logId)          | String (uuid)        | POST to replay API, return new log data   |
| hasActiveFilters          | computed             | True if any filter is non-default         |

## Entity: Replay Log

A replay log is a standard `webhook_logs` record with:

- `replayed_from` set to the original log's ID
- `status: 'pending'` (starts fresh lifecycle)
- `received_at: now()` (new timestamp)
- Same `endpoint_id`, `request_method`, `request_url`, `request_headers`, `request_body` as original

## Status Values (unchanged)

| Status     | Description                     | Terminal? |
| ---------- | ------------------------------- | --------- |
| pending    | Waiting for relay pickup        | No        |
| forwarding | Being forwarded to local server | No        |
| responded  | Local server responded          | Yes       |
| timeout    | No response within timeout      | Yes       |
| error      | Forwarding failed               | Yes       |

Replay is allowed from any terminal status (responded, timeout, error).
