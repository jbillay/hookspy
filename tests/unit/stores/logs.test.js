import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLogsStore } from '../../../src/stores/logs.js'

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}

const mockClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
}

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({ client: mockClient }),
}))

vi.mock('../../../src/stores/auth.js', () => ({
  useAuthStore: () => ({
    session: { access_token: 'test-token' },
  }),
}))

vi.mock('../../../src/stores/endpoints.js', () => ({
  useEndpointsStore: () => ({
    endpoints: [
      { id: 'ep-1', is_active: true },
      { id: 'ep-2', is_active: false },
    ],
  }),
}))

describe('Logs Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    global.fetch = vi.fn()
    mockClient.removeChannel.mockClear()
    mockClient.channel.mockClear()
    mockChannel.on.mockClear().mockReturnThis()
    mockChannel.subscribe.mockClear().mockReturnThis()
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      const store = useLogsStore()
      expect(store.logs).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.totalCount).toBe(0)
      expect(store.currentPage).toBe(1)
      expect(store.pageSize).toBe(50)
      expect(store.endpointFilter).toBeNull()
    })
  })

  describe('fetchLogs', () => {
    it('calls API with correct params and updates state', async () => {
      const mockData = [{ id: 'log-1' }, { id: 'log-2' }]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockData, total: 2 }),
      })

      const store = useLogsStore()
      await store.fetchLogs()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/logs?'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      )
      expect(store.logs).toEqual(mockData)
      expect(store.totalCount).toBe(2)
      expect(store.loading).toBe(false)
    })

    it('includes endpoint_id param when filter is set', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      })

      const store = useLogsStore()
      store.endpointFilter = 'ep-1'
      await store.fetchLogs()

      const url = global.fetch.mock.calls[0][0]
      expect(url).toContain('endpoint_id=ep-1')
    })

    it('handles API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      const store = useLogsStore()
      const result = await store.fetchLogs()

      expect(result).toEqual({ error: 'Server error' })
      expect(store.error).toBe('Server error')
      expect(store.loading).toBe(false)
    })
  })

  describe('setPage', () => {
    it('updates currentPage and calls fetchLogs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      })

      const store = useLogsStore()
      await store.setPage(3)

      expect(store.currentPage).toBe(3)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('setEndpointFilter', () => {
    it('updates filter, resets page, and calls fetchLogs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      })

      const store = useLogsStore()
      store.currentPage = 5
      await store.setEndpointFilter('ep-1')

      expect(store.endpointFilter).toBe('ep-1')
      expect(store.currentPage).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('startSubscription', () => {
    it('creates Realtime channel with correct filter', () => {
      const store = useLogsStore()
      store.startSubscription()

      expect(mockClient.channel).toHaveBeenCalledWith('log-viewer')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs',
          filter: 'endpoint_id=in.(ep-1,ep-2)',
        }),
        expect.any(Function),
      )
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
        }),
        expect.any(Function),
      )
    })

    it('uses endpointFilter when set', () => {
      const store = useLogsStore()
      store.endpointFilter = 'ep-1'
      store.startSubscription()

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          filter: 'endpoint_id=in.(ep-1)',
        }),
        expect.any(Function),
      )
    })
  })

  describe('stopSubscription', () => {
    it('removes channel when one exists', () => {
      const store = useLogsStore()
      store.startSubscription()
      store.stopSubscription()

      expect(mockClient.removeChannel).toHaveBeenCalled()
    })

    it('does nothing when no channel exists', () => {
      const store = useLogsStore()
      store.stopSubscription()

      expect(mockClient.removeChannel).not.toHaveBeenCalled()
    })
  })
})
