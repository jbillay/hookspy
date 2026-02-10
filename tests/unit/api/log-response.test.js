import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockGetUser(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}))

vi.mock('../../../api/_lib/auth.js', () => ({
  verifyAuth: vi.fn(async (req) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing or invalid Authorization header' }
    }
    if (authHeader === 'Bearer valid-token') {
      return { user: { id: 'user-1', email: 'test@example.com' }, error: null }
    }
    return { user: null, error: 'Invalid or expired token' }
  }),
}))

vi.mock('../../../api/_lib/cors.js', () => ({
  handleCors: vi.fn((req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(200).end()
      return true
    }
    return false
  }),
  setCorsHeaders: vi.fn(),
}))

const { default: handler } = await import('../../../api/logs/[id]/response.js')

function createMockReq(overrides = {}) {
  return {
    method: 'POST',
    query: { id: 'log-1' },
    headers: {
      authorization: 'Bearer valid-token',
      'content-type': 'application/json',
    },
    body: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    },
    ...overrides,
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    status: vi.fn(function (code) {
      this.statusCode = code
      return this
    }),
    json: vi.fn(function (data) {
      this.body = data
      this.ended = true
      return this
    }),
    setHeader: vi.fn(function (key, value) {
      this.headers[key] = value
      return this
    }),
    end: vi.fn(function () {
      this.ended = true
      return this
    }),
  }
  return res
}

function setupSupabaseMocks({
  log = {
    id: 'log-1',
    status: 'pending',
    endpoint_id: 'ep-1',
    received_at: new Date(Date.now() - 1000).toISOString(),
    endpoints: { user_id: 'user-1' },
  },
  logError = null,
  updateResult = { id: 'log-1' },
  updateError = null,
} = {}) {
  mockFrom.mockImplementation((table) => {
    if (table === 'webhook_logs') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: log,
              error: logError,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: updateResult,
            error: updateError,
          }),
        }),
      }
    }
    return {}
  })
}

describe('response submission - api/logs/[id]/response', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockGetUser.mockReset()
  })

  describe('CORS', () => {
    it('handles OPTIONS preflight', async () => {
      const req = createMockReq({ method: 'OPTIONS' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('method validation', () => {
    it('returns 405 for GET requests', async () => {
      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('returns 405 for PUT requests', async () => {
      const req = createMockReq({ method: 'PUT' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })
  })

  describe('authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = createMockReq({
        headers: { 'content-type': 'application/json' },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header',
      })
    })

    it('returns 401 when token is invalid', async () => {
      const req = createMockReq({
        headers: {
          authorization: 'Bearer invalid-token',
          'content-type': 'application/json',
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      })
    })
  })

  describe('log lookup', () => {
    it('returns 404 when log not found', async () => {
      setupSupabaseMocks({ log: null, logError: { message: 'not found' } })
      const req = createMockReq()
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Log not found' })
    })
  })

  describe('ownership verification', () => {
    it('returns 403 when user does not own the endpoint', async () => {
      setupSupabaseMocks({
        log: {
          id: 'log-1',
          status: 'pending',
          endpoint_id: 'ep-1',
          received_at: new Date().toISOString(),
          endpoints: { user_id: 'other-user' },
        },
      })
      const req = createMockReq()
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'You do not own this endpoint',
      })
    })
  })

  describe('status validation', () => {
    it('returns 409 when log is already responded', async () => {
      setupSupabaseMocks({
        log: {
          id: 'log-1',
          status: 'responded',
          endpoint_id: 'ep-1',
          received_at: new Date().toISOString(),
          endpoints: { user_id: 'user-1' },
        },
      })
      const req = createMockReq()
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({ error: 'Log already resolved' })
    })

    it('returns 409 when log is already timed out', async () => {
      setupSupabaseMocks({
        log: {
          id: 'log-1',
          status: 'timeout',
          endpoint_id: 'ep-1',
          received_at: new Date().toISOString(),
          endpoints: { user_id: 'user-1' },
        },
      })
      const req = createMockReq()
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({ error: 'Log already resolved' })
    })

    it('returns 409 when log is already in error state', async () => {
      setupSupabaseMocks({
        log: {
          id: 'log-1',
          status: 'error',
          endpoint_id: 'ep-1',
          received_at: new Date().toISOString(),
          endpoints: { user_id: 'user-1' },
        },
      })
      const req = createMockReq()
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({ error: 'Log already resolved' })
    })
  })

  describe('successful response submission', () => {
    it('updates log to responded with response data', async () => {
      setupSupabaseMocks()
      const req = createMockReq({
        body: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"ok":true}',
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.success).toBe(true)
      expect(res.body.log_id).toBe('log-1')
      expect(res.body.status).toBe('responded')
      expect(typeof res.body.duration_ms).toBe('number')
    })

    it('accepts forwarding status logs', async () => {
      setupSupabaseMocks({
        log: {
          id: 'log-1',
          status: 'forwarding',
          endpoint_id: 'ep-1',
          received_at: new Date(Date.now() - 2000).toISOString(),
          endpoints: { user_id: 'user-1' },
        },
      })
      const req = createMockReq()
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('error report submission', () => {
    it('updates log to error with error message', async () => {
      setupSupabaseMocks()
      const req = createMockReq({
        body: { error: 'Connection refused: localhost:3000' },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.success).toBe(true)
      expect(res.body.status).toBe('error')
      expect(typeof res.body.duration_ms).toBe('number')
    })
  })

  describe('request validation', () => {
    it('returns 400 when body is missing required fields', async () => {
      setupSupabaseMocks()
      const req = createMockReq({ body: { foo: 'bar' } })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error:
          'Request body must include either {status, headers, body} or {error}',
      })
    })

    it('returns 400 when body is empty', async () => {
      setupSupabaseMocks()
      const req = createMockReq({ body: {} })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })
  })
})
