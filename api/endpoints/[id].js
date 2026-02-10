import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'

function validateUpdate(body) {
  if (body.name !== undefined && (!body.name || !body.name.trim())) {
    return 'Name is required'
  }
  if (
    body.target_port !== undefined &&
    (body.target_port < 1 || body.target_port > 65535)
  ) {
    return 'Port must be between 1 and 65535'
  }
  if (
    body.timeout_seconds !== undefined &&
    (body.timeout_seconds < 1 || body.timeout_seconds > 55)
  ) {
    return 'Timeout must be between 1 and 55 seconds'
  }
  if (body.custom_headers) {
    const keys = Object.keys(body.custom_headers)
    for (const key of keys) {
      if (!key.trim()) {
        return 'Header name cannot be empty'
      }
    }
  }
  return null
}

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

  setCorsHeaders(res)

  const { user, error: authError } = await verifyAuth(req)
  if (authError) {
    return res.status(401).json({ error: authError })
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
    const validationError = validateUpdate(body)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const updates = {}
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = field === 'name' ? body[field].trim() : body[field]
      }
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
