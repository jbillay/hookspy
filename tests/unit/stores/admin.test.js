import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock fetch
global.fetch = vi.fn()

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    },
  }),
}))

describe('admin store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('has correct initial state', async () => {
    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()

    expect(store.users).toEqual([])
    expect(store.stats).toBeNull()
    expect(store.auditLog).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('fetchUsers updates users and pagination', async () => {
    const mockData = {
      data: [{ id: '1', email: 'test@test.com', plan: 'free' }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    }

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    await store.fetchUsers()

    expect(store.users).toEqual(mockData.data)
    expect(store.usersPagination).toEqual(mockData.pagination)
  })

  it('fetchStats updates stats', async () => {
    const mockStats = {
      data: {
        total_users: 10,
        users_by_plan: { free: 8, pro: 2 },
        users_by_status: { active: 9, disabled: 1 },
        total_endpoints: 15,
        requests_24h: 100,
      },
    }

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    await store.fetchStats()

    expect(store.stats).toEqual(mockStats.data)
  })

  it('changePlan sends PUT request', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: '1', plan: 'pro' },
          endpoints_deactivated: 0,
        }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.changePlan('1', 'pro')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/users/1/plan',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(result.data.plan).toBe('pro')
  })

  it('changeStatus sends PUT request', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { id: '1', status: 'disabled' } }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.changeStatus('1', 'disabled')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/users/1/status',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(result.data.status).toBe('disabled')
  })

  it('handles fetch errors gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchUsers()

    expect(result.error).toBe('Unauthorized')
  })
})
