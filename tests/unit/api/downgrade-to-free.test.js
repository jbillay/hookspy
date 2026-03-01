import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
const mockIn = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}))

function setupMockFrom(implementations) {
  let callCount = 0
  mockFrom.mockImplementation((table) => {
    const impl = implementations[table]
    if (typeof impl === 'function') return impl(callCount++)
    return impl || {}
  })
}

describe('downgradeToFree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('sets plan to free and plan_changed_at', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    setupMockFrom({
      profiles: () => ({
        update: (data) => {
          mockUpdate(data)
          return { eq: updateEq }
        },
      }),
      plan_config: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { max_endpoints: 3 },
              error: null,
            }),
          }),
        }),
      },
      endpoints: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }),
        }),
      },
    })

    const { downgradeToFree } = await import('../../../api/_lib/plans.js')
    const result = await downgradeToFree('user-123')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free' }),
    )
    expect(mockUpdate.mock.calls[0][0].plan_changed_at).toBeDefined()
    expect(result.endpointsDeactivated).toBe(0)
  })

  it('deactivates excess endpoints (most recently created first)', async () => {
    const deactivateIds = ['ep-4', 'ep-5']
    const mockLimit = vi.fn().mockResolvedValue({
      data: deactivateIds.map((id) => ({ id })),
      error: null,
    })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEndpointEq2 = vi.fn()

    mockEndpointEq2.mockImplementation(() => {
      return { order: mockOrder }
    })

    const mockInUpdate = vi.fn().mockResolvedValue({ error: null })
    mockIn.mockReturnValue(mockInUpdate)

    let endpointCallCount = 0
    setupMockFrom({
      profiles: () => ({
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      plan_config: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { max_endpoints: 3 },
              error: null,
            }),
          }),
        }),
      },
      endpoints: () => {
        endpointCallCount++
        if (endpointCallCount === 1) {
          // Count query
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
              }),
            }),
          }
        }
        if (endpointCallCount === 2) {
          // Select excess endpoints
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockEndpointEq2,
              }),
            }),
          }
        }
        // Deactivate
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      },
    })

    const { downgradeToFree } = await import('../../../api/_lib/plans.js')
    const result = await downgradeToFree('user-123')

    expect(result.endpointsDeactivated).toBe(2)
  })

  it('handles user with no excess endpoints', async () => {
    setupMockFrom({
      profiles: () => ({
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      plan_config: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { max_endpoints: 3 },
              error: null,
            }),
          }),
        }),
      },
      endpoints: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }),
        }),
      },
    })

    const { downgradeToFree } = await import('../../../api/_lib/plans.js')
    const result = await downgradeToFree('user-123')

    expect(result.endpointsDeactivated).toBe(0)
  })

  it('returns 0 deactivated when plan update fails', async () => {
    setupMockFrom({
      profiles: () => ({
        update: () => ({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'update failed' },
          }),
        }),
      }),
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { downgradeToFree } = await import('../../../api/_lib/plans.js')
    const result = await downgradeToFree('user-123')

    expect(result.endpointsDeactivated).toBe(0)
    consoleSpy.mockRestore()
  })

  it('is idempotent for already-free users', async () => {
    setupMockFrom({
      profiles: () => ({
        update: (data) => {
          mockUpdate(data)
          return { eq: vi.fn().mockResolvedValue({ error: null }) }
        },
      }),
      plan_config: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { max_endpoints: 3 },
              error: null,
            }),
          }),
        }),
      },
      endpoints: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        }),
      },
    })

    const { downgradeToFree } = await import('../../../api/_lib/plans.js')
    const result = await downgradeToFree('user-123')

    // Still sets plan to free (idempotent)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free' }),
    )
    expect(result.endpointsDeactivated).toBe(0)
  })
})
