import { supabase } from '../../_lib/supabase.js'
import { verifyAuth } from '../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(res)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  const { id } = req.query

  // Fetch original log with ownership check
  const { data: log, error: logError } = await supabase
    .from('webhook_logs')
    .select('*, endpoints!inner(name, slug, user_id)')
    .eq('id', id)
    .single()

  if (logError || !log) {
    return res.status(404).json({ error: 'Log not found' })
  }

  if (log.endpoints.user_id !== user.id) {
    return res.status(404).json({ error: 'Log not found' })
  }

  // Verify endpoint still exists
  const { data: endpoint, error: epError } = await supabase
    .from('endpoints')
    .select('id')
    .eq('id', log.endpoint_id)
    .single()

  if (epError || !endpoint) {
    return res.status(404).json({ error: 'Endpoint no longer exists' })
  }

  // Create replay log
  const { data: newLog, error: insertError } = await supabase
    .from('webhook_logs')
    .insert({
      endpoint_id: log.endpoint_id,
      status: 'pending',
      request_method: log.request_method,
      request_url: log.request_url,
      request_headers: log.request_headers,
      request_body: log.request_body,
      replayed_from: log.id,
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  return res.status(201).json({ data: newLog })
}
