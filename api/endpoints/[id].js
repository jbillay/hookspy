import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { validateEndpoint } from '../_lib/validation.js'
import { getPlanLimits } from '../_lib/plans.js'

const ALLOWED_FIELDS = [
  'name',
  'target_url',
  'target_port',
  'target_path',
  'timeout_seconds',
  'custom_headers',
  'is_active',
]

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  setCorsHeaders(req, res)

  const { user, profile, error: authError } = await verifyAuth(req)
  if (authError) {
    const status = authError === 'account_disabled' ? 401 : 401
    return res.status(status).json({ error: authError })
  }

  const { id } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('endpoints')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Endpoint not found' })
    }

    return res.status(200).json({ data })
  }

  if (req.method === 'PUT') {
    const body = req.body || {}
    const validationError = validateEndpoint(body, { requireName: false })
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    // If activating, check active count against plan limit
    if (body.is_active === true) {
      const limits = await getPlanLimits(profile?.plan || 'free')
      if (limits) {
        const { count: activeCount } = await supabase
          .from('endpoints')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true)

        if (activeCount >= limits.max_endpoints) {
          // Check if this endpoint is already active (no net change)
          const { data: current } = await supabase
            .from('endpoints')
            .select('is_active')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

          if (!current?.is_active) {
            return res.status(403).json({
              error: 'Active endpoint limit reached',
              message:
                'Deactivate another endpoint first to activate this one.',
              active: activeCount,
              max: limits.max_endpoints,
            })
          }
        }
      }
    }

    const updates = {}
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = field === 'name' ? body[field].trim() : body[field]
      }
    }

    // Strip custom headers for Free users
    if (updates.custom_headers && profile?.plan === 'free') {
      delete updates.custom_headers
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const { data, error } = await supabase
      .from('endpoints')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Endpoint not found' })
    }

    return res.status(200).json({ data })
  }

  if (req.method === 'DELETE') {
    const { data, error } = await supabase
      .from('endpoints')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Endpoint not found' })
    }

    return res.status(200).json({ message: 'Endpoint deleted' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
