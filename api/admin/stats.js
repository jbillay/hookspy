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

  // Total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  // Users by plan
  const { count: freeUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('plan', 'free')

  const { count: proUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('plan', 'pro')

  // Users by status
  const { count: activeUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: disabledUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'disabled')

  // Total endpoints
  const { count: totalEndpoints } = await supabase
    .from('endpoints')
    .select('id', { count: 'exact', head: true })

  // Requests in last 24h
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
