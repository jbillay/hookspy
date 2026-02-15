const ALLOWED_ORIGINS = getAllowedOrigins()

function getAllowedOrigins() {
  const appUrl = process.env.VITE_APP_URL
  if (!appUrl) {
    console.warn(
      'VITE_APP_URL is not set — CORS will reject all cross-origin requests',
    )
    return []
  }
  // Support comma-separated origins for multi-environment setups
  return appUrl
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function getOrigin(req) {
  const origin = req.headers?.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin
  }
  return null
}

export function setCorsHeaders(req, res) {
  const origin = getOrigin(req)
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  )
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

export function handleCors(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}
