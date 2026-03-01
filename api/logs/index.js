import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { getPlanLimits } from '../_lib/plans.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(req, res)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user, profile, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  // Check plan limits for search capability
  const limits = await getPlanLimits(profile?.plan || 'free')
  const canSearch = limits?.can_search || false

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

  // Advanced filters - only for users with search capability
  if (canSearch) {
    if (method) {
      const methods = method.split(',').filter(Boolean)
      if (methods.length > 0) {
        query = query.in('request_method', methods)
      }
    }

    if (dateFrom) {
      query = query.gte('received_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('received_at', dateTo)
    }

    if (q) {
      // Allowlist: keep only alphanumeric, spaces, hyphens, underscores, dots, colons, slashes
      const allowlisted = q.replace(/[^a-zA-Z0-9 \-_.:/]/g, '').trim()
      if (allowlisted) {
        // Escape LIKE wildcards to prevent pattern injection
        const escaped = allowlisted.replace(/%/g, '\\%').replace(/_/g, '\\_')
        query = query.or(
          `request_body.ilike.%${escaped}%,request_url.ilike.%${escaped}%,response_body.ilike.%${escaped}%,error_message.ilike.%${escaped}%`,
        )
      }
    }
  }

  // Status filter is always available
  if (status) {
    const statuses = status.split(',').filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Log list query failed:', error.message)
    return res.status(500).json({ error: 'Internal server error' })
  }

  const mapped = (data || []).map((log) => ({
    ...log,
    endpoint_name: log.endpoints?.name,
    endpoint_slug: log.endpoints?.slug,
    endpoints: undefined,
  }))

  return res.status(200).json({ data: mapped, total: count })
}
