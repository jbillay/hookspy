import { supabase } from '../../_lib/supabase.js'
import { verifyAuth } from '../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../_lib/cors.js'

export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return
  setCorsHeaders(res)

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify authentication
  const { user, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  const { id } = req.query

  // Look up the webhook log with endpoint info for ownership check
  const { data: log, error: logError } = await supabase
    .from('webhook_logs')
    .select('*, endpoints(user_id)')
    .eq('id', id)
    .single()

  if (logError || !log) {
    return res.status(404).json({ error: 'Log not found' })
  }

  // Verify ownership
  if (log.endpoints.user_id !== user.id) {
    return res.status(403).json({ error: 'You do not own this endpoint' })
  }

  // Check if log is already resolved
  const terminalStatuses = ['responded', 'timeout', 'error']
  if (terminalStatuses.includes(log.status)) {
    return res.status(409).json({ error: 'Log already resolved' })
  }

  const body = req.body
  const now = new Date()
  const receivedAt = new Date(log.received_at)
  const durationMs = now.getTime() - receivedAt.getTime()

  // Handle error report from browser relay
  if (body && body.error) {
    await supabase
      .from('webhook_logs')
      .update({
        status: 'error',
        error_message: body.error,
        responded_at: now.toISOString(),
        duration_ms: durationMs,
      })
      .eq('id', id)

    return res.status(200).json({
      success: true,
      log_id: id,
      status: 'error',
      duration_ms: durationMs,
    })
  }

  // Handle successful response from browser relay
  if (
    body &&
    body.status !== undefined &&
    body.headers !== undefined &&
    body.body !== undefined
  ) {
    await supabase
      .from('webhook_logs')
      .update({
        status: 'responded',
        response_status: body.status,
        response_headers: body.headers,
        response_body: body.body,
        responded_at: now.toISOString(),
        duration_ms: durationMs,
      })
      .eq('id', id)

    return res.status(200).json({
      success: true,
      log_id: id,
      status: 'responded',
      duration_ms: durationMs,
    })
  }

  // Invalid request body
  return res.status(400).json({
    error:
      'Request body must include either {status, headers, body} or {error}',
  })
}
