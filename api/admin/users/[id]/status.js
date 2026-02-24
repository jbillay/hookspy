import { supabase } from '../../../_lib/supabase.js'
import { verifyAuth } from '../../../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../../../_lib/cors.js'
import { requireAdmin } from '../../../_lib/plans.js'

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
  const { status } = req.body || {}

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
    return res.status(500).json({ error: updateError.message })
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
