import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(req, res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  const {
    endpoint_id,
    page = '1',
    limit = '50',
    method,
    status,
    from: dateFrom,
    to: dateTo,
    q,
  } = req.query
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
  const rangeFrom = (pageNum - 1) * limitNum
  const rangeTo = rangeFrom + limitNum - 1

  let query = supabase
    .from('webhook_logs')
    .select('*, endpoints!inner(name, slug, user_id)', { count: 'exact' })
    .eq('endpoints.user_id', user.id)
    .order('received_at', { ascending: false })
    .range(rangeFrom, rangeTo)

  if (endpoint_id) {
    query = query.eq('endpoint_id', endpoint_id)
  }

  if (method) {
    const methods = method.split(',').filter(Boolean)
    if (methods.length > 0) {
      query = query.in('request_method', methods)
    }
  }

  if (status) {
    const statuses = status.split(',').filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  if (dateFrom) {
    query = query.gte('received_at', dateFrom)
  }

  if (dateTo) {
    query = query.lte('received_at', dateTo)
  }

  if (q) {
    // Sanitize: strip PostgREST operators to prevent query injection
    const sanitized = q.replace(/[,.*()\\]/g, '').trim()
    if (sanitized) {
      query = query.or(
        `request_body.ilike.%${sanitized}%,request_url.ilike.%${sanitized}%,response_body.ilike.%${sanitized}%,error_message.ilike.%${sanitized}%`,
      )
    }
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
