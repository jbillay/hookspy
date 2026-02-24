import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { getPlanLimits } from '../_lib/plans.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  setCorsHeaders(req, res)

  const { user, error: authError } = await verifyAuth(req)
  if (authError) {
    return res.status(401).json({ error: authError })
  }

  if (req.method === 'GET') {
    // Fetch full profile
    const { data: fullProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !fullProfile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    // Get plan limits
    const limits = await getPlanLimits(fullProfile.plan)

    // Get usage stats
    const { count: endpointsCount } = await supabase
      .from('endpoints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: endpointsActive } = await supabase
      .from('endpoints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    return res.status(200).json({
      data: {
        ...fullProfile,
        limits,
        usage: {
          endpoints_count: endpointsCount || 0,
          endpoints_active: endpointsActive || 0,
        },
      },
    })
  }

  if (req.method === 'PUT') {
    const body = req.body || {}

    // Only allow display_name update
    const { display_name } = body

    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || display_name.length > 100) {
        return res
          .status(400)
          .json({ error: 'display_name must be a string under 100 characters' })
      }
    }

    // Reject plan/role/status changes from non-admin users
    if (body.plan || body.role || body.status) {
      return res.status(403).json({
        error: 'Cannot modify plan, role, or status via profile endpoint',
      })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: display_name?.trim() || null })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ data })
  }

  if (req.method === 'DELETE') {
    // Check if user is an admin — if so, ensure they're not the last one
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userProfile?.role === 'admin') {
      const { count: adminCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('status', 'active')

      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Cannot delete the last active admin account',
        })
      }
    }

    // Delete the user (cascades to profiles, endpoints, webhook_logs)
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
