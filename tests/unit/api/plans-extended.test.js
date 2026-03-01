import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}))

function makeChain(resolvedValue) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(resolvedValue),
      }),
    }),
  }
}

function makeCountChain(resolvedValue) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(resolvedValue),
    }),
  }
}

describe('plans.js - checkEndpointLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns not allowed when profile is null', async () => {
    const { checkEndpointLimit } = await import('../../../api/_lib/plans.js')

    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: 'not found' } }),
    )

    const result = await checkEndpointLimit('user-123')
    expect(result.allowed).toBe(false)
    expect(result.current).toBe(0)
    expect(result.max).toBe(0)
  })

  it('returns not allowed when plan limits are null', async () => {
    const { checkEndpointLimit } = await import('../../../api/_lib/plans.js')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return makeChain({
          data: { plan: 'unknown', role: 'user', status: 'active' },
          error: null,
        })
      }
      return makeChain({ data: null, error: { message: 'err' } })
    })

    const result = await checkEndpointLimit('user-123')
    expect(result.allowed).toBe(false)
  })

  it('returns allowed when under limit', async () => {
    const { checkEndpointLimit } = await import('../../../api/_lib/plans.js')

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return makeChain({
          data: { plan: 'free', role: 'user', status: 'active' },
          error: null,
        })
      }
      if (table === 'plan_config') {
        return makeChain({
          data: { plan: 'free', max_endpoints: 3 },
          error: null,
        })
      }
      if (table === 'endpoints') {
        return makeCountChain({ count: 1, error: null })
      }
      return {}
    })

    const result = await checkEndpointLimit('user-123')
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(1)
    expect(result.max).toBe(3)
  })

  it('returns not allowed when endpoint count query errors', async () => {
    const { checkEndpointLimit } = await import('../../../api/_lib/plans.js')

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return makeChain({
          data: { plan: 'free', role: 'user', status: 'active' },
          error: null,
        })
      }
      if (table === 'plan_config') {
        return makeChain({
          data: { plan: 'free', max_endpoints: 3 },
          error: null,
        })
      }
      if (table === 'endpoints') {
        return makeCountChain({ count: null, error: { message: 'db error' } })
      }
      return {}
    })

    const result = await checkEndpointLimit('user-123')
    expect(result.allowed).toBe(false)
    expect(result.max).toBe(3)
  })
})

describe('plans.js - checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns not allowed when plan limits are null', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: 'err' } }),
    )

    const { checkRateLimit } = await import('../../../api/_lib/plans.js')
    const result = await checkRateLimit('slug-123', 'unknown')
    expect(result.allowed).toBe(false)
  })

  it('returns not allowed (fail-closed) when RPC errors', async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { plan: 'free', requests_per_min: 30 },
        error: null,
      }),
    )

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc error' },
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { checkRateLimit } = await import('../../../api/_lib/plans.js')
    const result = await checkRateLimit('slug-123', 'free')

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    consoleSpy.mockRestore()
  })

  it('returns allowed when under rate limit', async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { plan: 'free', requests_per_min: 30 },
        error: null,
      }),
    )

    mockRpc.mockResolvedValue({ data: 5, error: null })

    const { checkRateLimit } = await import('../../../api/_lib/plans.js')
    const result = await checkRateLimit('slug-123', 'free')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(25)
    expect(result.resetAt).toBeInstanceOf(Date)
  })

  it('returns not allowed when over rate limit', async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { plan: 'free', requests_per_min: 30 },
        error: null,
      }),
    )

    mockRpc.mockResolvedValue({ data: 31, error: null })

    const { checkRateLimit } = await import('../../../api/_lib/plans.js')
    const result = await checkRateLimit('slug-123', 'free')

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe('plans.js - getPlanLimits caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('caches plan limits after first call', async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { plan: 'free', max_endpoints: 3, requests_per_min: 30 },
        error: null,
      }),
    )

    const { getPlanLimits } = await import('../../../api/_lib/plans.js')

    const result1 = await getPlanLimits('free')
    const result2 = await getPlanLimits('free')

    expect(result1).toEqual(result2)
    // from() should only be called once due to caching
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})

describe('plans.js - requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns admin true for admin profile', async () => {
    const { requireAdmin } = await import('../../../api/_lib/plans.js')
    const result = await requireAdmin({ role: 'admin' })
    expect(result.admin).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns admin false for non-admin profile', async () => {
    const { requireAdmin } = await import('../../../api/_lib/plans.js')
    const result = await requireAdmin({ role: 'user' })
    expect(result.admin).toBe(false)
    expect(result.error).toMatch(/admin/)
  })

  it('returns admin false for null profile', async () => {
    const { requireAdmin } = await import('../../../api/_lib/plans.js')
    const result = await requireAdmin(null)
    expect(result.admin).toBe(false)
  })
})
