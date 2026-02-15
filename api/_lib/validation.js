const FORBIDDEN_HEADERS = new Set([
  'host',
  'authorization',
  'cookie',
  'set-cookie',
  'origin',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
])

const MAX_CUSTOM_HEADERS = 50
const MAX_HEADER_NAME_LENGTH = 256
const MAX_HEADER_VALUE_LENGTH = 8192

/**
 * Validate target_url is a safe HTTP(S) URL.
 * Returns an error string or null if valid.
 */
export function validateTargetUrl(url) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Only http and https protocols are allowed for target URL'
    }
  } catch {
    return 'Invalid target URL format'
  }

  return null
}

/**
 * Validate custom_headers for injection attacks and forbidden overrides.
 * Returns an error string or null if valid.
 */
export function validateCustomHeaders(headers) {
  if (!headers || typeof headers !== 'object') return null

  const entries = Object.entries(headers)

  if (entries.length > MAX_CUSTOM_HEADERS) {
    return `Maximum ${MAX_CUSTOM_HEADERS} custom headers allowed`
  }

  for (const [key, value] of entries) {
    if (!key || !key.trim()) {
      return 'Header name cannot be empty'
    }

    if (key.length > MAX_HEADER_NAME_LENGTH) {
      return `Header name "${key.slice(0, 20)}..." exceeds maximum length of ${MAX_HEADER_NAME_LENGTH}`
    }

    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) {
      return `Header "${key}" cannot be overridden`
    }

    if (typeof value !== 'string') {
      return `Header "${key}" value must be a string`
    }

    if (value.length > MAX_HEADER_VALUE_LENGTH) {
      return `Header "${key}" value exceeds maximum length of ${MAX_HEADER_VALUE_LENGTH}`
    }

    // Block CRLF injection
    if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) {
      return 'Header names and values cannot contain newline characters'
    }
  }

  return null
}

/**
 * Validate an endpoint create/update body.
 * Returns an error string or null if valid.
 */
export function validateEndpoint(body, { requireName = true } = {}) {
  if (requireName && (!body.name || !body.name.trim())) {
    return 'Name is required'
  }
  if (
    !requireName &&
    body.name !== undefined &&
    (!body.name || !body.name.trim())
  ) {
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

  const urlError = validateTargetUrl(body.target_url)
  if (urlError) return urlError

  const headersError = validateCustomHeaders(body.custom_headers)
  if (headersError) return headersError

  return null
}
