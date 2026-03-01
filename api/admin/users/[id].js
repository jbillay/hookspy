import { supabase } from '../../_lib/supabase.js'
import { verifyAuth } from '../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../_lib/cors.js'
import { requireAdmin, downgradeToFree } from '../../_lib/plans.js'
import { isValidUUID } from '../../_lib/validation.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  setCorsHeaders(req, res)

  const { user, profile, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  const { admin, error: adminError } = await requireAdmin(profile)
  if (!admin) {
    return res.status(403).json({ error: adminError })
  }

  const { id } = req.query

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' })
  }

  if (req.method === 'GET') {
    return handleGet(id, res)
  }

  if (req.method === 'PUT') {
    return handlePut(id, user, req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(id, res) {
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

async function handlePut(id, user, req, res) {
  const body = req.body || {}

  if (body.plan !== undefined) {
    return handlePlanChange(id, user, body, res)
  }

  if (body.status !== undefined) {
    return handleStatusChange(id, user, body, res)
  }

  return res
    .status(400)
    .json({ error: 'Request must include "plan" or "status" field' })
}

async function handlePlanChange(id, user, body, res) {
  const { plan } = body

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

  // Handle downgrade via shared helper, or direct update for upgrade
  let endpointsDeactivated = 0
  let updated

  if (plan === 'free' && oldPlan === 'pro') {
    const result = await downgradeToFree(id)
    endpointsDeactivated = result.endpointsDeactivated

    // Re-fetch the updated profile
    const { data: refreshed, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr) {
      console.error(
        'Admin plan change: failed to re-fetch profile:',
        fetchErr.message,
      )
      return res.status(500).json({ error: 'Internal server error' })
    }
    updated = refreshed
  } else {
    // Upgrade path (free → pro)
    const { data: upgradeData, error: updateError } = await supabase
      .from('profiles')
      .update({ plan, plan_changed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Admin plan change failed:', updateError.message)
      return res.status(500).json({ error: 'Internal server error' })
    }
    updated = upgradeData
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

async function handleStatusChange(id, user, body, res) {
  const { status } = body

  if (!status || !['active', 'disabled'].includes(status)) {
    return res
      .status(400)
      .json({ error: 'status must be "active" or "disabled"' })
  }

  // Prevent self-modification
  if (id === user.id) {
    return res
      .status(400)
      .json({ error: 'Cannot modify your own status via admin endpoint' })
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

  // Prevent disabling the last active admin
  if (status === 'disabled' && targetUser.role === 'admin') {
    const { count: activeAdmins } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'active')

    if (activeAdmins <= 1) {
      return res.status(400).json({
        error: 'Cannot disable the last active admin',
      })
    }
  }

  const oldStatus = targetUser.status

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    console.error('Admin status change failed:', updateError.message)
    return res.status(500).json({ error: 'Internal server error' })
  }

  // Insert audit log entry
  await supabase.from('admin_audit_log').insert({
    admin_id: user.id,
    target_user_id: id,
    action: 'status_change',
    old_value: { status: oldStatus },
    new_value: { status },
  })

  return res.status(200).json({ data: updated })
}
