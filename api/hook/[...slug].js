import { supabase } from '../_lib/supabase.js'
import { handleCors, setCorsHeaders } from '../_lib/cors.js'

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
}

const MAX_BODY_SIZE = 1024 * 1024 // 1MB
const POLL_INTERVAL_MS = 500
const RATE_LIMIT_WINDOW_MS = 60000
const RATE_LIMIT_MAX = 60

// In-memory rate limiting (per serverless instance)
const rateLimitMap = new Map()

function checkRateLimit(slug) {
  const now = Date.now()
  const windowKey = `${slug}:${Math.floor(now / RATE_LIMIT_WINDOW_MS)}`

  // Clean old entries
  for (const [key] of rateLimitMap) {
    if (!key.startsWith(slug + ':') || key === windowKey) continue
    rateLimitMap.delete(key)
  }

  const count = rateLimitMap.get(windowKey) || 0
  if (count >= RATE_LIMIT_MAX) {
    return false
  }
  rateLimitMap.set(windowKey, count + 1)
  return true
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalSize = 0

    req.on('data', (chunk) => {
      totalSize += chunk.length
      if (totalSize > MAX_BODY_SIZE) {
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
  setCorsHeaders(res)

  // Parse slug and sub-path from req.url to avoid relying on req.query.slug
  // which may be undefined in prebuilt deployments.
  // req.url example: /api/hook/c4572dc1/stripe/events?q=test
  const urlPath = (req.url || '').split('?')[0]
  const hookPrefix = '/api/hook/'
  const afterHook = urlPath.startsWith(hookPrefix)
    ? urlPath.slice(hookPrefix.length)
    : ''
  const segments = afterHook.split('/').filter(Boolean)
  const slug = segments[0] || req.query.slug
  const subPath = segments.length > 1 ? '/' + segments.slice(1).join('/') : null

  // Read raw body with size limit
  let body
  try {
    body = await readBody(req)
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      return res.status(413).json({ error: 'Payload Too Large' })
    }
    return res.status(500).json({ error: 'Failed to read request body' })
  }

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

  // Check rate limit
  if (!checkRateLimit(slug)) {
    return res.status(429).json({ error: 'Too Many Requests' })
  }

  // Build request URL with query string
  const requestUrl = req.url || `/api/hook/${slug}`

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

  // Polling loop
  const timeoutMs = (endpoint.timeout_seconds || 30) * 1000
  const startTime = Date.now()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sleep(POLL_INTERVAL_MS)

    const elapsed = Date.now() - startTime

    // Check timeout
    if (elapsed >= timeoutMs) {
      await supabase
        .from('webhook_logs')
        .update({ status: 'timeout' })
        .eq('id', log.id)

      return res.status(504).json({
        error: 'Gateway Timeout',
        message: `Local server did not respond within ${endpoint.timeout_seconds || 30}s`,
      })
    }

    // Poll for status change
    const { data: current, error: pollError } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('id', log.id)
      .single()

    if (pollError || !current) {
      return res.status(500).json({ error: 'Failed to poll webhook status' })
    }

    if (current.status === 'responded') {
      // Return the stored response to the external system
      if (current.response_headers) {
        for (const [key, value] of Object.entries(current.response_headers)) {
          const lowerKey = key.toLowerCase()
          // Skip headers that Vercel manages
          if (
            lowerKey === 'transfer-encoding' ||
            lowerKey === 'connection' ||
            lowerKey === 'content-length'
          ) {
            continue
          }
          res.setHeader(key, value)
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

    // pending or forwarding — continue polling
  }
}
