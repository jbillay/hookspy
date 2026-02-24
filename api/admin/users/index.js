import { supabase } from '../../_lib/supabase.js'
import { verifyAuth } from '../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../_lib/cors.js'
import { requireAdmin } from '../../_lib/plans.js'

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

  const { admin, error: adminError } = await requireAdmin(profile)
  if (!admin) {
    return res.status(403).json({ error: adminError })
  }

  const {
    page = '1',
    limit = '20',
    search,
    plan,
    status,
    sort = 'created_at',
    order = 'desc',
  } = req.query

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const rangeFrom = (pageNum - 1) * limitNum
  const rangeTo = rangeFrom + limitNum - 1

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .range(rangeFrom, rangeTo)

  if (search) {
    query = query.ilike('email', `%${search}%`)
  }

  if (plan && ['free', 'pro'].includes(plan)) {
    query = query.eq('plan', plan)
  }

  if (status && ['active', 'disabled'].includes(status)) {
    query = query.eq('status', status)
  }

  const validSorts = ['created_at', 'email', 'plan']
  const sortField = validSorts.includes(sort) ? sort : 'created_at'
  const ascending = order === 'asc'
  query = query.order(sortField, { ascending })

  const { data: users, error, count } = await query

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Get endpoint counts for each user
  const userIds = users.map((u) => u.id)
  let endpointCounts = {}

  if (userIds.length > 0) {
    const { data: endpoints } = await supabase
      .from('endpoints')
      .select('user_id')
      .in('user_id', userIds)

    if (endpoints) {
      for (const ep of endpoints) {
        endpointCounts[ep.user_id] = (endpointCounts[ep.user_id] || 0) + 1
      }
    }
  }

  const enriched = users.map((u) => ({
    ...u,
    endpoints_count: endpointCounts[u.id] || 0,
  }))

  return res.status(200).json({
    data: enriched,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      pages: Math.ceil(count / limitNum),
    },
  })
}
