import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { requireAdmin } from '../_lib/plans.js'

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

  const route = req.query._route
  if (route === 'stats') return handleStats(res)
  if (route === 'audit-log') return handleAuditLog(req, res)
  if (route === 'users') return handleUsers(req, res)

  return res.status(404).json({ error: 'Not found' })
}

async function handleStats(res) {
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const { count: freeUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('plan', 'free')

  const { count: proUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('plan', 'pro')

  const { count: activeUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: disabledUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'disabled')

  const { count: totalEndpoints } = await supabase
    .from('endpoints')
    .select('id', { count: 'exact', head: true })

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: requests24h } = await supabase
    .from('webhook_logs')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', since24h)

  return res.status(200).json({
    data: {
      total_users: totalUsers || 0,
      users_by_plan: {
        free: freeUsers || 0,
        pro: proUsers || 0,
      },
      users_by_status: {
        active: activeUsers || 0,
        disabled: disabledUsers || 0,
      },
      total_endpoints: totalEndpoints || 0,
      requests_24h: requests24h || 0,
    },
  })
}

async function handleAuditLog(req, res) {
  const { page = '1', limit = '50', target_user_id, action } = req.query

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
  const rangeFrom = (pageNum - 1) * limitNum
  const rangeTo = rangeFrom + limitNum - 1

  let query = supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeTo)

  if (target_user_id) {
    query = query.eq('target_user_id', target_user_id)
  }

  if (action) {
    query = query.eq('action', action)
  }

  const { data: entries, error, count } = await query

  if (error) {
    console.error('Audit log query failed:', error.message)
    return res.status(500).json({ error: 'Internal server error' })
  }

  const adminIds = [...new Set(entries.map((e) => e.admin_id))]
  const targetIds = [...new Set(entries.map((e) => e.target_user_id))]
  const allIds = [...new Set([...adminIds, ...targetIds])]

  let emailMap = {}
  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', allIds)

    if (profiles) {
      for (const p of profiles) {
        emailMap[p.id] = p.email
      }
    }
  }

  const enriched = entries.map((e) => ({
    ...e,
    admin_email: emailMap[e.admin_id] || 'Unknown',
    target_email: emailMap[e.target_user_id] || 'Unknown',
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

async function handleUsers(req, res) {
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
    console.error('Admin users query failed:', error.message)
    return res.status(500).json({ error: 'Internal server error' })
  }

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
