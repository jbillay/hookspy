# Quickstart: Replay & Search

## Prerequisites

- Dev server running (`npm run dev`)
- Authenticated user with at least one active endpoint
- At least 3-5 webhook logs already captured (use `curl` to trigger webhooks against your endpoint slug)

## Verification Scenarios

### 1. Replay a Webhook

1. Navigate to an endpoint's detail page (Endpoints → click an endpoint)
2. Expand a log entry with status "responded"
3. Click the "Replay" button
4. **Verify**: A new log entry appears at the top of the list with:
   - Status: "pending" (then "forwarding" → "responded" if relay is active)
   - A "Replay" badge or icon distinguishing it from the original
   - Same request method, URL, headers, and body as the original
5. **Verify**: The `replayed_from` field references the original log's ID

### 2. Replay with Relay Active

1. Ensure the browser relay is active (RelayStatus shows "Active")
2. Replay a webhook from step 1
3. **Verify**: The replayed log transitions through pending → forwarding → responded
4. **Verify**: The response data matches what your local server returned

### 3. Text Search

1. Navigate to /logs (All Logs view)
2. Type a keyword that appears in one of your webhook bodies (e.g., a JSON field name)
3. **Verify**: Only matching logs are shown
4. **Verify**: The URL updates to include `?q=your-search-term`
5. Clear the search box
6. **Verify**: All logs reappear

### 4. Method and Status Filters

1. In the /logs view, select "POST" from the method filter dropdown
2. **Verify**: Only POST logs are shown
3. Add "error" to the status filter
4. **Verify**: Only POST logs with error status are shown (may be empty)
5. Click "Clear all filters"
6. **Verify**: All logs reappear and URL query params are cleared

### 5. Date Range Filter

1. Set the "From" date to 1 hour ago
2. **Verify**: Only logs from the last hour are shown
3. Clear the date range
4. **Verify**: All logs reappear

### 6. Combined Filters + Realtime

1. Set a method filter (e.g., POST) and a search term
2. Send a new webhook via curl that matches both filters
3. **Verify**: The new log appears in the filtered list in real time
4. Send a webhook that does NOT match (e.g., different method)
5. **Verify**: The non-matching log does NOT appear in the filtered view

### 7. Bookmark Filters

1. Apply several filters (method + status + search)
2. Copy the current URL
3. Open a new browser tab and paste the URL
4. **Verify**: The same filters are active and the same results are shown
