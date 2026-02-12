import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  const { id } = req.query

  const { data: log, error } = await supabase
    .from('webhook_logs')
    .select('*, endpoints!inner(name, slug, user_id)')
    .eq('id', id)
    .single()

  if (error || !log) {
    return res.status(404).json({ error: 'Log not found' })
  }

  if (log.endpoints.user_id !== user.id) {
    return res.status(404).json({ error: 'Log not found' })
  }

  const mapped = {
    ...log,
    endpoint_name: log.endpoints?.name,
    endpoint_slug: log.endpoints?.slug,
    endpoints: undefined,
  }

  return res.status(200).json({ data: mapped })
}
