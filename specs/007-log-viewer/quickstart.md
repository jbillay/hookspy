# Quickstart: Log Viewer Verification

## Prerequisites

- Dev server running (`npm run dev`)
- Supabase project running with webhook_logs table
- At least one endpoint created and active
- Browser relay active (green dot in header)

## Verification Steps

### 1. Log List View (US1)

1. Navigate to an endpoint's detail page
2. Click "View Logs" (or navigate to the logs section)
3. Open a terminal and send a webhook:
   ```bash
   curl -X POST https://your-app.vercel.app/api/hook/your-slug \
     -H "Content-Type: application/json" \
     -d '{"event":"test","data":"hello"}'
   ```
4. Verify: A new log entry appears at the top of the table within 1 second
5. Verify: Status badge shows `pending` (blue) → `forwarding` (blue, pulsing) → `responded` (green)
6. Verify: Timestamp, method (POST badge), URL path, and duration are displayed

### 2. Log Detail Expansion (US2)

1. Click the expander arrow on a log entry with status `responded`
2. Verify: The row expands inline showing two sections side by side
3. Verify: Left section ("Request") shows: method badge, URL, headers list, body
4. Verify: Right section ("Response") shows: status code, headers list, body
5. Verify: JSON bodies are pretty-printed with syntax highlighting
6. Click "Raw" toggle — verify body switches to raw text view
7. Click the expander arrow again — verify the row collapses

### 3. Status Badges (US1)

1. Send a webhook while local server is stopped:
   ```bash
   curl -X POST https://your-app.vercel.app/api/hook/your-slug \
     -H "Content-Type: application/json" \
     -d '{"event":"error-test"}'
   ```
2. Verify: Status shows `error` with red badge
3. Hover over the error badge — verify error message tooltip appears

### 4. Combined Log View (US3)

1. Navigate to "All Logs" or "Logs" in the header navigation
2. Verify: Logs from all endpoints are shown in a single list
3. Verify: Each entry shows the endpoint name
4. Verify: New webhooks from any endpoint appear in real time

### 5. Pagination (FR-013)

1. Ensure more than 50 logs exist (send multiple webhooks if needed)
2. Verify: Page controls appear at the bottom of the table
3. Click page 2 — verify older logs are displayed
4. Verify: Total count is accurate

### 6. Edge Cases

1. **Empty body**: Send `curl -X GET https://your-app.vercel.app/api/hook/your-slug`
   - Verify: "No body" placeholder in the expanded detail
2. **Timing display**: Verify duration shows "234ms" format for < 1s, "1.2s" for >= 1s
3. **Timeout log**: Verify timeout entries show orange badge and "No response — timed out" in detail

## Expected Outcome

- Log list loads with correct columns and real-time updates
- Row expansion shows full request/response details inline
- JSON bodies are syntax-highlighted and toggleable
- Pagination works with numbered page controls
- Combined view shows logs from all endpoints with endpoint names
