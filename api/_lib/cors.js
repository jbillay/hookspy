const allowedOrigin = process.env.VITE_APP_URL || '*'

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  )
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

export function handleCors(req, res) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}
