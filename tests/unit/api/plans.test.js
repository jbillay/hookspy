import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockRpc = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    from: (...args) => {
      mockFrom(...args)
      return {
        select: (...sArgs) => {
          mockSelect(...sArgs)
          return {
            eq: (...eArgs) => {
              mockEq(...eArgs)
              return {
                single: () => mockSingle(),
                eq: (...e2) => {
                  mockEq(...e2)
                  return { single: () => mockSingle() }
                },
              }
            },
          }
        },
      }
    },
    rpc: (...args) => mockRpc(...args),
  },
}))

describe('plans.js middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPlanLimits', () => {
    it('returns plan config for free plan', async () => {
      const freeLimits = {
        plan: 'free',
        max_endpoints: 3,
        requests_per_min: 30,
        max_body_bytes: 262144,
        log_retention_hours: 6,
        max_timeout_seconds: 30,
        can_replay: false,
        can_search: false,
        can_inject_headers: false,
      }

      mockSingle.mockResolvedValueOnce({ data: freeLimits, error: null })

      const { getPlanLimits } = await import('../../../api/_lib/plans.js')
      const result = await getPlanLimits('free')

      expect(result).toEqual(freeLimits)
      expect(mockFrom).toHaveBeenCalledWith('plan_config')
    })

    it('returns plan config for pro plan', async () => {
      const proLimits = {
        plan: 'pro',
        max_endpoints: 25,
        requests_per_min: 120,
        max_body_bytes: 5242880,
        log_retention_hours: 168,
        max_timeout_seconds: 55,
        can_replay: true,
        can_search: true,
        can_inject_headers: true,
      }

      mockSingle.mockResolvedValueOnce({ data: proLimits, error: null })

      // Need fresh import to bypass cache
      vi.resetModules()
      const { getPlanLimits } = await import('../../../api/_lib/plans.js')
      const result = await getPlanLimits('pro')

      expect(result).toEqual(proLimits)
    })

    it('returns null on error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      })

      vi.resetModules()
      const { getPlanLimits } = await import('../../../api/_lib/plans.js')
      const result = await getPlanLimits('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getUserPlan', () => {
    it('returns user profile plan info', async () => {
      const profile = { plan: 'free', role: 'user', status: 'active' }
      mockSingle.mockResolvedValueOnce({ data: profile, error: null })

      vi.resetModules()
      const { getUserPlan } = await import('../../../api/_lib/plans.js')
      const result = await getUserPlan('user-123')

      expect(result).toEqual(profile)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('returns null when user not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      })

      vi.resetModules()
      const { getUserPlan } = await import('../../../api/_lib/plans.js')
      const result = await getUserPlan('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('requireAdmin', () => {
    it('returns admin: true for admin profile', async () => {
      vi.resetModules()
      const { requireAdmin } = await import('../../../api/_lib/plans.js')
      const result = await requireAdmin({
        role: 'admin',
        plan: 'free',
        status: 'active',
      })

      expect(result).toEqual({ admin: true, error: null })
    })

    it('returns admin: false for non-admin profile', async () => {
      vi.resetModules()
      const { requireAdmin } = await import('../../../api/_lib/plans.js')
      const result = await requireAdmin({
        role: 'user',
        plan: 'free',
        status: 'active',
      })

      expect(result.admin).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('returns admin: false for null profile', async () => {
      vi.resetModules()
      const { requireAdmin } = await import('../../../api/_lib/plans.js')
      const result = await requireAdmin(null)

      expect(result.admin).toBe(false)
    })
  })
})
