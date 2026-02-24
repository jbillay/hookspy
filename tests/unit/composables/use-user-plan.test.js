import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  plan: 'free',
                  max_endpoints: 3,
                  requests_per_min: 30,
                  can_replay: false,
                  can_search: false,
                  can_inject_headers: false,
                },
                error: null,
              }),
          }),
        }),
      }),
    },
  }),
}))

describe('useUserPlan composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exports expected properties', async () => {
    const { useUserPlan } =
      await import('../../../src/composables/use-user-plan.js')
    const result = useUserPlan()

    expect(result).toHaveProperty('plan')
    expect(result).toHaveProperty('role')
    expect(result).toHaveProperty('isPro')
    expect(result).toHaveProperty('isFree')
    expect(result).toHaveProperty('isAdmin')
    expect(result).toHaveProperty('canReplay')
    expect(result).toHaveProperty('canSearch')
    expect(result).toHaveProperty('canInjectHeaders')
    expect(result).toHaveProperty('limits')
    expect(result).toHaveProperty('endpointsMax')
  })

  it('defaults to free plan when no profile', async () => {
    const { useUserPlan } =
      await import('../../../src/composables/use-user-plan.js')
    const { plan, isFree, isPro, isAdmin } = useUserPlan()

    expect(plan.value).toBe('free')
    expect(isFree.value).toBe(true)
    expect(isPro.value).toBe(false)
    expect(isAdmin.value).toBe(false)
  })

  it('computes canReplay as false for free plan', async () => {
    const { useUserPlan } =
      await import('../../../src/composables/use-user-plan.js')
    const { canReplay, canSearch, canInjectHeaders } = useUserPlan()

    expect(canReplay.value).toBe(false)
    expect(canSearch.value).toBe(false)
    expect(canInjectHeaders.value).toBe(false)
  })
})
