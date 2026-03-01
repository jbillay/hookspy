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
      '/api/admin/users/1',
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
      '/api/admin/users/1',
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

  it('fetchUsers passes query params', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [],
          pagination: { page: 2, limit: 10, total: 0, pages: 0 },
        }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    await store.fetchUsers({
      page: 2,
      limit: 10,
      search: 'test',
      plan: 'pro',
      status: 'active',
      sort: 'email',
      order: 'asc',
    })

    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('page=2')
    expect(url).toContain('limit=10')
    expect(url).toContain('search=test')
    expect(url).toContain('plan=pro')
    expect(url).toContain('status=active')
    expect(url).toContain('sort=email')
    expect(url).toContain('order=asc')
  })

  it('fetchUsers returns fallback error message when none provided', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchUsers()

    expect(result.error).toBe('Failed to fetch users')
  })

  it('fetchUserDetail returns user data on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ data: { id: '1', email: 'user@test.com' } }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchUserDetail('1')

    expect(result.data.email).toBe('user@test.com')
  })

  it('fetchUserDetail returns error on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchUserDetail('999')

    expect(result.error).toBe('Not found')
  })

  it('fetchUserDetail returns fallback error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchUserDetail('999')

    expect(result.error).toBe('Failed to fetch user')
  })

  it('changePlan handles error response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Plan change failed' }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.changePlan('1', 'pro')

    expect(result.error).toBe('Plan change failed')
    expect(store.loading).toBe(false)
  })

  it('changePlan returns fallback error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.changePlan('1', 'pro')

    expect(result.error).toBe('Failed to change plan')
  })

  it('changePlan updates user in local list', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: '1', plan: 'pro', email: 'test@test.com' },
        }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    store.users = [{ id: '1', plan: 'free', email: 'test@test.com' }]

    await store.changePlan('1', 'pro')

    expect(store.users[0].plan).toBe('pro')
  })

  it('changeStatus handles error response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Status change failed' }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.changeStatus('1', 'disabled')

    expect(result.error).toBe('Status change failed')
  })

  it('changeStatus returns fallback error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.changeStatus('1', 'disabled')

    expect(result.error).toBe('Failed to change status')
  })

  it('changeStatus updates user in local list', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { id: '1', status: 'disabled' } }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    store.users = [{ id: '1', status: 'active' }]

    await store.changeStatus('1', 'disabled')

    expect(store.users[0].status).toBe('disabled')
  })

  it('fetchStats handles error response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Stats error' }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchStats()

    expect(result.error).toBe('Stats error')
    expect(store.loading).toBe(false)
  })

  it('fetchStats returns fallback error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchStats()

    expect(result.error).toBe('Failed to fetch stats')
  })

  it('fetchAuditLog returns data and updates state', async () => {
    const mockData = {
      data: [{ id: '1', action: 'plan_change' }],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    }

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchAuditLog()

    expect(store.auditLog).toEqual(mockData.data)
    expect(store.auditPagination).toEqual(mockData.pagination)
    expect(result.data).toEqual(mockData.data)
  })

  it('fetchAuditLog passes query params', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [],
          pagination: { page: 1, limit: 50, total: 0, pages: 0 },
        }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    await store.fetchAuditLog({
      page: 2,
      limit: 25,
      target_user_id: 'user-1',
      action: 'plan_change',
    })

    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('page=2')
    expect(url).toContain('limit=25')
    expect(url).toContain('target_user_id=user-1')
    expect(url).toContain('action=plan_change')
  })

  it('fetchAuditLog handles error response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Audit log error' }),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchAuditLog()

    expect(result.error).toBe('Audit log error')
    expect(store.loading).toBe(false)
  })

  it('fetchAuditLog returns fallback error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const { useAdminStore } = await import('../../../src/stores/admin.js')
    const store = useAdminStore()
    const result = await store.fetchAuditLog()

    expect(result.error).toBe('Failed to fetch audit log')
  })
})
