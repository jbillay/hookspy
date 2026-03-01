import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}))

const mockVerifyAuth = vi.fn()
vi.mock('../../../api/_lib/auth.js', () => ({
  verifyAuth: (...args) => mockVerifyAuth(...args),
}))

vi.mock('../../../api/_lib/cors.js', () => ({
  handleCors: vi.fn(() => false),
  setCorsHeaders: vi.fn(),
}))

vi.mock('../../../api/_lib/plans.js', () => ({
  checkEndpointLimit: vi.fn().mockResolvedValue({
    allowed: true,
    current: 1,
    max: 3,
  }),
  getPlanLimits: vi.fn().mockResolvedValue({
    plan: 'free',
    max_endpoints: 3,
    requests_per_min: 30,
    max_body_bytes: 262144,
  }),
}))

const { default: indexHandler } =
  await import('../../../api/endpoints/index.js')

function createReq(overrides = {}) {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
    body: {},
    ...overrides,
  }
}

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      res.statusCode = code
      return res
    },
    json(data) {
      res.body = data
      return res
    },
    setHeader(key, value) {
      res.headers[key] = value
    },
    end() {},
  }
  return res
}

describe('GET /api/endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockVerifyAuth.mockResolvedValue({
      user: null,
      error: 'Missing or invalid Authorization header',
    })

    const req = createReq()
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('Missing or invalid Authorization header')
  })

  it('returns endpoints for authenticated user', async () => {
    const mockEndpoints = [{ id: 'ep-1', name: 'Test' }]
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockEndpoints,
            error: null,
          }),
        }),
      }),
    })

    const req = createReq()
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.data).toEqual(mockEndpoints)
    expect(mockFrom).toHaveBeenCalledWith('endpoints')
  })
})

describe('POST /api/endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when name is missing', async () => {
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })

    const req = createReq({ method: 'POST', body: {} })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Name is required')
  })

  it('creates endpoint with defaults', async () => {
    const created = {
      id: 'ep-1',
      name: 'My Webhook',
      slug: 'a1b2c3d4',
    }
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle.mockResolvedValue({
            data: created,
            error: null,
          }),
        }),
      }),
    })

    const req = createReq({
      method: 'POST',
      body: { name: 'My Webhook' },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(201)
    expect(res.body.data).toEqual(created)
  })

  it('validates port range', async () => {
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })

    const req = createReq({
      method: 'POST',
      body: { name: 'Test', target_port: 99999 },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Port must be between 1 and 65535')
  })

  it('validates timeout range', async () => {
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })

    const req = createReq({
      method: 'POST',
      body: { name: 'Test', timeout_seconds: 60 },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Timeout must be between 1 and 55 seconds')
  })

  it('returns 405 for unsupported methods', async () => {
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })

    const req = createReq({ method: 'DELETE' })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(405)
  })

  it('returns 403 when endpoint limit is reached', async () => {
    const { checkEndpointLimit, getPlanLimits } =
      await import('../../../api/_lib/plans.js')
    checkEndpointLimit.mockResolvedValueOnce({
      allowed: false,
      current: 3,
      max: 3,
    })
    getPlanLimits.mockResolvedValueOnce({
      plan: 'free',
      max_endpoints: 3,
      requests_per_min: 30,
    })

    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })

    const req = createReq({
      method: 'POST',
      body: { name: 'New Endpoint' },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('Endpoint limit reached')
    expect(res.body.current).toBe(3)
    expect(res.body.max).toBe(3)
  })

  it('returns 500 when insert query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle.mockResolvedValue({
            data: null,
            error: { message: 'unique constraint violated' },
          }),
        }),
      }),
    })

    const req = createReq({
      method: 'POST',
      body: { name: 'My Webhook' },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Internal server error')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Endpoint create failed:',
      'unique constraint violated',
    )

    consoleSpy.mockRestore()
  })
})

describe('GET /api/endpoints error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 when GET query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'connection timeout' },
          }),
        }),
      }),
    })

    const req = createReq()
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Internal server error')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Endpoint list query failed:',
      'connection timeout',
    )

    consoleSpy.mockRestore()
  })

  it('returns 403 for account_disabled auth error', async () => {
    mockVerifyAuth.mockResolvedValue({
      user: null,
      error: 'account_disabled',
    })

    const req = createReq()
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('account_disabled')
  })

  it('strips custom_headers for free plan users', async () => {
    const created = { id: 'ep-1', name: 'Test', custom_headers: {} }
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle.mockResolvedValue({
            data: created,
            error: null,
          }),
        }),
      }),
    })

    const req = createReq({
      method: 'POST',
      body: {
        name: 'Test',
        custom_headers: { 'X-Custom': 'value' },
      },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(201)
    // The insert call should have empty custom_headers for free plan
    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.custom_headers).toEqual({})
  })

  it('preserves custom_headers for pro plan users', async () => {
    const customHeaders = { 'X-Custom': 'value' }
    const created = { id: 'ep-1', name: 'Test', custom_headers: customHeaders }
    mockVerifyAuth.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { plan: 'pro', role: 'user', status: 'active' },
      error: null,
    })
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle.mockResolvedValue({
            data: created,
            error: null,
          }),
        }),
      }),
    })

    const req = createReq({
      method: 'POST',
      body: {
        name: 'Test',
        custom_headers: customHeaders,
      },
    })
    const res = createRes()
    await indexHandler(req, res)

    expect(res.statusCode).toBe(201)
    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.custom_headers).toEqual(customHeaders)
  })
})
