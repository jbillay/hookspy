import { supabase } from '../../../_lib/supabase.js'
import { verifyAuth } from '../../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../../_lib/cors.js'
import { requireAdmin, getPlanLimits } from '../../../_lib/plans.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(req, res)

  if (req.method !== 'PUT') {
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
  const { plan } = req.body || {}

  if (!plan || !['free', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "free" or "pro"' })
  }

  // Prevent self-modification
  if (id === user.id) {
    return res
      .status(400)
      .json({ error: 'Cannot modify your own plan via admin endpoint' })
  }

  // Get current profile
  const { data: targetUser, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !targetUser) {
    return res.status(404).json({ error: 'User not found' })
  }

  const oldPlan = targetUser.plan

  if (oldPlan === plan) {
    return res.status(200).json({ data: targetUser, endpoints_deactivated: 0 })
  }

  // Update plan
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ plan, plan_changed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  // Handle downgrade: deactivate excess endpoints
  let endpointsDeactivated = 0
  if (plan === 'free' && oldPlan === 'pro') {
    const limits = await getPlanLimits('free')
    if (limits) {
      const { count: activeCount } = await supabase
        .from('endpoints')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .eq('is_active', true)

      if (activeCount > limits.max_endpoints) {
        const excess = activeCount - limits.max_endpoints

        // Get most recently created active endpoints to deactivate
        const { data: toDeactivate } = await supabase
          .from('endpoints')
          .select('id')
          .eq('user_id', id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(excess)

        if (toDeactivate && toDeactivate.length > 0) {
          const ids = toDeactivate.map((e) => e.id)
          await supabase
            .from('endpoints')
            .update({ is_active: false })
            .in('id', ids)

          endpointsDeactivated = ids.length
        }
      }
    }
  }

  // Insert audit log entry
  await supabase.from('admin_audit_log').insert({
    admin_id: user.id,
    target_user_id: id,
    action: 'plan_change',
    old_value: { plan: oldPlan },
    new_value: { plan },
  })

  return res.status(200).json({
    data: updated,
    endpoints_deactivated: endpointsDeactivated,
  })
}
