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

  const { endpoint_id, page = '1', limit = '50' } = req.query
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
  const from = (pageNum - 1) * limitNum
  const to = from + limitNum - 1

  let query = supabase
    .from('webhook_logs')
    .select('*, endpoints!inner(name, slug, user_id)', { count: 'exact' })
    .eq('endpoints.user_id', user.id)
    .order('received_at', { ascending: false })
    .range(from, to)

  if (endpoint_id) {
    query = query.eq('endpoint_id', endpoint_id)
  }

  const { data, error, count } = await query

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const mapped = (data || []).map((log) => ({
    ...log,
    endpoint_name: log.endpoints?.name,
    endpoint_slug: log.endpoints?.slug,
    endpoints: undefined,
  }))

  return res.status(200).json({ data: mapped, total: count })
}
