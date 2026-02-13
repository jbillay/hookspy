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

function mockFetchSuccess(data = [], total = 0) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data, total }),
  })
}

function mockFetchError(error = 'Server error') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error }),
  })
}

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
      expect(store.methodFilter).toEqual([])
      expect(store.statusFilter).toEqual([])
      expect(store.searchQuery).toBe('')
      expect(store.dateFrom).toBeNull()
      expect(store.dateTo).toBeNull()
    })
  })

  describe('hasActiveFilters', () => {
    it('returns false when no filters are set', () => {
      const store = useLogsStore()
      expect(store.hasActiveFilters).toBe(false)
    })

    it('returns true when method filter is set', () => {
      const store = useLogsStore()
      store.methodFilter = ['GET']
      expect(store.hasActiveFilters).toBe(true)
    })

    it('returns true when status filter is set', () => {
      const store = useLogsStore()
      store.statusFilter = ['pending']
      expect(store.hasActiveFilters).toBe(true)
    })

    it('returns true when search query is set', () => {
      const store = useLogsStore()
      store.searchQuery = 'test'
      expect(store.hasActiveFilters).toBe(true)
    })

    it('returns true when date range is set', () => {
      const store = useLogsStore()
      store.dateFrom = new Date()
      expect(store.hasActiveFilters).toBe(true)
    })
  })

  describe('fetchLogs', () => {
    it('calls API with correct params and updates state', async () => {
      const mockData = [{ id: 'log-1' }, { id: 'log-2' }]
      mockFetchSuccess(mockData, 2)

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
      mockFetchSuccess()

      const store = useLogsStore()
      store.endpointFilter = 'ep-1'
      await store.fetchLogs()

      const url = global.fetch.mock.calls[0][0]
      expect(url).toContain('endpoint_id=ep-1')
    })

    it('includes filter params in API call', async () => {
      mockFetchSuccess()

      const store = useLogsStore()
      store.methodFilter = ['GET', 'POST']
      store.statusFilter = ['pending']
      store.searchQuery = 'test'
      store.dateFrom = new Date('2026-01-01T00:00:00Z')
      store.dateTo = new Date('2026-01-31T23:59:59Z')
      await store.fetchLogs()

      const url = global.fetch.mock.calls[0][0]
      expect(url).toContain('method=GET%2CPOST')
      expect(url).toContain('status=pending')
      expect(url).toContain('q=test')
      expect(url).toContain('from=')
      expect(url).toContain('to=')
    })

    it('handles API errors', async () => {
      mockFetchError('Server error')

      const store = useLogsStore()
      const result = await store.fetchLogs()

      expect(result).toEqual({ error: 'Server error' })
      expect(store.error).toBe('Server error')
      expect(store.loading).toBe(false)
    })
  })

  describe('setMethodFilter', () => {
    it('updates filter, resets page, and calls fetchLogs', async () => {
      mockFetchSuccess()

      const store = useLogsStore()
      store.currentPage = 3
      await store.setMethodFilter(['GET', 'POST'])

      expect(store.methodFilter).toEqual(['GET', 'POST'])
      expect(store.currentPage).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('setStatusFilter', () => {
    it('updates filter, resets page, and calls fetchLogs', async () => {
      mockFetchSuccess()

      const store = useLogsStore()
      store.currentPage = 3
      await store.setStatusFilter(['pending', 'error'])

      expect(store.statusFilter).toEqual(['pending', 'error'])
      expect(store.currentPage).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('setSearchQuery', () => {
    it('updates query, resets page, and calls fetchLogs', async () => {
      mockFetchSuccess()

      const store = useLogsStore()
      store.currentPage = 2
      await store.setSearchQuery('webhook')

      expect(store.searchQuery).toBe('webhook')
      expect(store.currentPage).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('setDateRange', () => {
    it('updates dates, resets page, and calls fetchLogs', async () => {
      mockFetchSuccess()

      const from = new Date('2026-01-01')
      const to = new Date('2026-01-31')
      const store = useLogsStore()
      store.currentPage = 2
      await store.setDateRange(from, to)

      expect(store.dateFrom).toBe(from)
      expect(store.dateTo).toBe(to)
      expect(store.currentPage).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('clearAllFilters', () => {
    it('resets all filters and calls fetchLogs', async () => {
      mockFetchSuccess()

      const store = useLogsStore()
      store.methodFilter = ['GET']
      store.statusFilter = ['pending']
      store.searchQuery = 'test'
      store.dateFrom = new Date()
      store.dateTo = new Date()
      store.currentPage = 3

      await store.clearAllFilters()

      expect(store.methodFilter).toEqual([])
      expect(store.statusFilter).toEqual([])
      expect(store.searchQuery).toBe('')
      expect(store.dateFrom).toBeNull()
      expect(store.dateTo).toBeNull()
      expect(store.currentPage).toBe(1)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('replayLog', () => {
    it('calls POST API and returns data on success', async () => {
      const newLog = { id: 'new-log', replayed_from: 'log-1' }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: newLog }),
      })

      const store = useLogsStore()
      const result = await store.replayLog('log-1')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/logs/log-1/replay',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      )
      expect(result).toEqual({ data: newLog })
    })

    it('returns error on failure', async () => {
      mockFetchError('Log not found')

      const store = useLogsStore()
      const result = await store.replayLog('bad-id')

      expect(result).toEqual({ error: 'Log not found' })
    })

    it('handles network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const store = useLogsStore()
      const result = await store.replayLog('log-1')

      expect(result).toEqual({ error: 'Network error' })
    })
  })

  describe('setPage', () => {
    it('updates currentPage and calls fetchLogs', async () => {
      mockFetchSuccess()

      const store = useLogsStore()
      await store.setPage(3)

      expect(store.currentPage).toBe(3)
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('setEndpointFilter', () => {
    it('updates filter, resets page, and calls fetchLogs', async () => {
      mockFetchSuccess()

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

  describe('matchesFilters (via Realtime INSERT)', () => {
    it('increments totalCount on INSERT regardless of filters', () => {
      const store = useLogsStore()
      store.methodFilter = ['DELETE']
      store.startSubscription()

      const insertCb = mockChannel.on.mock.calls.find(
        (c) => c[1].event === 'INSERT',
      )[2]
      insertCb({
        new: { id: 'log-new', request_method: 'GET', status: 'pending' },
      })

      expect(store.totalCount).toBe(1)
      expect(store.logs).toHaveLength(0) // doesn't match filter
    })

    it('prepends log when it matches method filter', () => {
      const store = useLogsStore()
      store.methodFilter = ['POST']
      store.startSubscription()

      const insertCb = mockChannel.on.mock.calls.find(
        (c) => c[1].event === 'INSERT',
      )[2]
      insertCb({
        new: { id: 'log-new', request_method: 'POST', status: 'pending' },
      })

      expect(store.logs).toHaveLength(1)
      expect(store.logs[0].id).toBe('log-new')
    })

    it('filters out logs not matching status filter', () => {
      const store = useLogsStore()
      store.statusFilter = ['responded']
      store.startSubscription()

      const insertCb = mockChannel.on.mock.calls.find(
        (c) => c[1].event === 'INSERT',
      )[2]
      insertCb({
        new: { id: 'log-new', request_method: 'GET', status: 'pending' },
      })

      expect(store.totalCount).toBe(1)
      expect(store.logs).toHaveLength(0)
    })

    it('filters by search query on request_body', () => {
      const store = useLogsStore()
      store.searchQuery = 'hello'
      store.startSubscription()

      const insertCb = mockChannel.on.mock.calls.find(
        (c) => c[1].event === 'INSERT',
      )[2]

      insertCb({
        new: {
          id: 'log-match',
          request_method: 'POST',
          status: 'pending',
          request_body: 'Hello World',
        },
      })
      expect(store.logs).toHaveLength(1)

      insertCb({
        new: {
          id: 'log-no-match',
          request_method: 'POST',
          status: 'pending',
          request_body: 'Goodbye',
        },
      })
      expect(store.logs).toHaveLength(1) // second log not added
    })
  })
})
