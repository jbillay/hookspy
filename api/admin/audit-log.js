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
    return res.status(500).json({ error: error.message })
  }

  // Enrich with emails
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
