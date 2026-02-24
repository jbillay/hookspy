import { supabase } from '../../../_lib/supabase.js'
import { verifyAuth } from '../../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../../_lib/cors.js'
import { requireAdmin } from '../../../_lib/plans.js'

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

  const { id } = req.query

  const { data: targetUser, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !targetUser) {
    return res.status(404).json({ error: 'User not found' })
  }

  // Get endpoint stats
  const { count: endpointsCount } = await supabase
    .from('endpoints')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)

  const { count: endpointsActive } = await supabase
    .from('endpoints')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .eq('is_active', true)

  return res.status(200).json({
    data: {
      ...targetUser,
      endpoints_count: endpointsCount || 0,
      endpoints_active: endpointsActive || 0,
    },
  })
}
