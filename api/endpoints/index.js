import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { validateEndpoint } from '../_lib/validation.js'
import { checkEndpointLimit, getPlanLimits } from '../_lib/plans.js'

function generateSlug() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  setCorsHeaders(req, res)

  const { user, profile, error: authError } = await verifyAuth(req)
  if (authError) {
    const status = authError === 'account_disabled' ? 403 : 401
    return res.status(status).json({ error: authError })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('endpoints')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Endpoint list query failed:', error.message)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({ data })
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const validationError = validateEndpoint(body)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    // Check endpoint limit
    const { allowed, current, max } = await checkEndpointLimit(user.id)
    if (!allowed) {
      const limits = await getPlanLimits(profile?.plan || 'free')
      return res.status(403).json({
        error: 'Endpoint limit reached',
        message: `Your ${profile?.plan || 'free'} plan allows up to ${max} endpoints. Upgrade to Pro for up to ${limits?.plan === 'pro' ? max : 25} endpoints.`,
        current,
        max,
      })
    }

    const slug = generateSlug()

    // Strip custom headers for Free users
    const customHeaders =
      profile?.plan === 'free' ? {} : body.custom_headers || {}

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
        custom_headers: customHeaders,
      })
      .select()
      .single()

    if (error) {
      console.error('Endpoint create failed:', error.message)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(201).json({ data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
