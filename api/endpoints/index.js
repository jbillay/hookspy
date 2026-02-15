import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { validateEndpoint } from '../_lib/validation.js'

function generateSlug() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  setCorsHeaders(req, res)

  const { user, error: authError } = await verifyAuth(req)
  if (authError) {
    return res.status(401).json({ error: authError })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('endpoints')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ data })
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const validationError = validateEndpoint(body)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const slug = generateSlug()

    const { data, error } = await supabase
      .from('endpoints')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        slug,
        target_url: body.target_url || 'http://localhost',
        target_port: body.target_port || 3000,
        target_path: body.target_path || '/',
        timeout_seconds: body.timeout_seconds || 30,
        custom_headers: body.custom_headers || {},
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json({ data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
