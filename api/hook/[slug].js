import { supabase } from '../_lib/supabase.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'
import { checkRateLimit, getPlanLimits } from '../_lib/plans.js'

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
}

const POLL_INTERVAL_MS = 500

function readBody(req, maxSize) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalSize = 0

    req.on('data', (chunk) => {
      totalSize += chunk.length
      if (totalSize > maxSize) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'))
    })

    req.on('error', (err) => {
      reject(err)
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return
  setCorsHeaders(req, res)

  const slug = req.query.slug
  const subPath = req.query._subpath || null

  // Look up endpoint by slug
  const { data: endpoint, error: epError } = await supabase
    .from('endpoints')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (epError || !endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' })
  }

  // Fetch owner profile separately (avoids indirect PostgREST join)
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('plan, status')
    .eq('id', endpoint.user_id)
    .single()

  // Check owner status
  if (ownerProfile?.status === 'disabled') {
    return res.status(403).json({ error: 'Endpoint owner account is disabled' })
  }

  const ownerPlan = ownerProfile?.plan || 'free'
  const limits = await getPlanLimits(ownerPlan)

  if (!limits) {
    return res.status(500).json({ error: 'Plan configuration not found' })
  }

  // Check rate limit
  const rateResult = await checkRateLimit(slug, ownerPlan)
  if (!rateResult.allowed) {
    const retryAfter = rateResult.resetAt
      ? Math.ceil((rateResult.resetAt.getTime() - Date.now()) / 1000)
      : 60
    res.setHeader('Retry-After', String(Math.max(1, retryAfter)))
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. ${ownerPlan} plan allows ${limits.requests_per_min} requests per minute.`,
    })
  }

  // Read raw body with plan-based size limit
  let body
  try {
    body = await readBody(req, limits.max_body_bytes)
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      return res.status(413).json({
        error: 'Payload Too Large',
        max_size: limits.max_body_bytes,
        message: `${ownerPlan} plan allows up to ${Math.round(limits.max_body_bytes / 1024)} KB request bodies.`,
      })
    }
    return res.status(500).json({ error: 'Failed to read request body' })
  }

  // Build clean request URL
  const requestUrl = `/api/hook/${slug}${subPath || ''}`

  // Insert webhook log
  const { data: log, error: insertError } = await supabase
    .from('webhook_logs')
    .insert({
      endpoint_id: endpoint.id,
      status: 'pending',
      request_method: req.method,
      request_url: requestUrl,
      request_headers: req.headers,
      request_body: body || null,
      request_subpath: subPath,
    })
    .select()
    .single()

  if (insertError || !log) {
    return res.status(500).json({ error: 'Failed to store webhook' })
  }

  // Cap effective timeout to plan limit
  const effectiveTimeout = Math.min(
    endpoint.timeout_seconds || 30,
    limits.max_timeout_seconds,
  )
  const timeoutMs = effectiveTimeout * 1000
  const startTime = Date.now()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sleep(POLL_INTERVAL_MS)

    const elapsed = Date.now() - startTime

    if (elapsed >= timeoutMs) {
      await supabase
        .from('webhook_logs')
        .update({ status: 'timeout' })
        .eq('id', log.id)

      return res.status(504).json({
        error: 'Gateway Timeout',
        message: `Local server did not respond within ${effectiveTimeout}s`,
      })
    }

    const { data: current, error: pollError } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('id', log.id)
      .single()

    if (pollError || !current) {
      return res.status(500).json({ error: 'Failed to poll webhook status' })
    }

    if (current.status === 'responded') {
      if (current.response_headers) {
        const BLOCKED_HEADERS = new Set([
          'transfer-encoding',
          'connection',
          'content-length',
          'set-cookie',
          'access-control-allow-origin',
          'access-control-allow-credentials',
          'host',
          'proxy-authorization',
        ])
        for (const [key, value] of Object.entries(current.response_headers)) {
          const lowerKey = key.toLowerCase()
          if (BLOCKED_HEADERS.has(lowerKey)) continue
          // Block CRLF injection in header names and values
          if (/[\r\n]/.test(key) || /[\r\n]/.test(String(value))) continue
          res.setHeader(key, String(value))
        }
      }
      res.status(current.response_status || 200)
      return res.end(current.response_body || '')
    }

    if (current.status === 'error') {
      return res.status(502).json({
        error: 'Bad Gateway',
        message: current.error_message || 'Local server error',
      })
    }
  }
}
