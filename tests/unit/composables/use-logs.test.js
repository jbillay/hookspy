import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLogs } from '../../../src/composables/use-logs.js'
import { useLogsStore } from '../../../src/stores/logs.js'

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
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

describe('useLogs composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns the logs store instance', () => {
    const logs = useLogs()
    const store = useLogsStore()
    expect(logs).toBe(store)
  })

  it('exposes reactive state properties', () => {
    const logs = useLogs()
    expect(logs).toHaveProperty('logs')
    expect(logs).toHaveProperty('loading')
    expect(logs).toHaveProperty('error')
    expect(logs).toHaveProperty('totalCount')
    expect(logs).toHaveProperty('currentPage')
    expect(logs).toHaveProperty('pageSize')
    expect(logs).toHaveProperty('endpointFilter')
  })

  it('exposes action methods', () => {
    const logs = useLogs()
    expect(typeof logs.fetchLogs).toBe('function')
    expect(typeof logs.setPage).toBe('function')
    expect(typeof logs.setEndpointFilter).toBe('function')
    expect(typeof logs.startSubscription).toBe('function')
    expect(typeof logs.stopSubscription).toBe('function')
  })
})
