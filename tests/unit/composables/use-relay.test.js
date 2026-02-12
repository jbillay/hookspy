import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRelay } from '../../../src/composables/use-relay.js'
import { useRelayStore } from '../../../src/stores/relay.js'

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
      })),
    },
  }),
}))

vi.mock('../../../src/stores/auth.js', () => ({
  useAuthStore: () => ({
    session: { access_token: 'test-token' },
  }),
}))

vi.mock('../../../src/stores/endpoints.js', () => ({
  useEndpointsStore: () => ({
    endpoints: [],
  }),
}))

describe('useRelay composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns the relay store instance', () => {
    const relay = useRelay()
    const store = useRelayStore()
    expect(relay).toBe(store)
  })

  it('exposes reactive state properties', () => {
    const relay = useRelay()
    expect(relay).toHaveProperty('relayStatus')
    expect(relay).toHaveProperty('forwardingCount')
    expect(relay).toHaveProperty('lastError')
  })

  it('exposes relay action methods', () => {
    const relay = useRelay()
    expect(typeof relay.startRelay).toBe('function')
    expect(typeof relay.stopRelay).toBe('function')
    expect(typeof relay.updateSubscription).toBe('function')
    expect(typeof relay.forwardWebhook).toBe('function')
  })

  it('exposes helper methods', () => {
    const relay = useRelay()
    expect(typeof relay.buildTargetUrl).toBe('function')
    expect(typeof relay.filterHeaders).toBe('function')
  })
})
