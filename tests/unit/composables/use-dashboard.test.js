import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  formatTimeAgo,
  useDashboard,
} from '../../../src/composables/use-dashboard.js'

const mockTransport = vi.hoisted(() => ({
  transportMode: { value: 'ws' },
  isConnected: { value: true },
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  updateSubscription: vi.fn(),
  seedSeenIds: vi.fn(),
}))

vi.mock('../../../src/composables/use-realtime-transport.js', () => ({
  useRealtimeTransport: () => mockTransport,
}))

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({ client: {} }),
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
      { id: 'ep-3', is_active: true },
    ],
  }),
}))

describe('useDashboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    global.fetch = vi.fn()
    mockTransport.subscribe.mockClear()
    mockTransport.unsubscribe.mockClear()
    mockTransport.seedSeenIds.mockClear()

    // Reset module-level state
    const dashboard = useDashboard()
    dashboard.recentLogs = []
    dashboard.requestCount24h = 0
  })

  describe('computed properties', () => {
    it('returns correct endpoint counts', () => {
      const dashboard = useDashboard()
      expect(dashboard.totalEndpoints).toBe(3)
      expect(dashboard.activeEndpoints).toBe(2)
      expect(dashboard.inactiveEndpoints).toBe(1)
      expect(dashboard.hasEndpoints).toBe(true)
    })
  })

  describe('fetchStats', () => {
    it('makes two API calls and populates state', async () => {
      const mockLogs = [
        { id: 'log-1', endpoint_name: 'Test' },
        { id: 'log-2', endpoint_name: 'Test' },
      ]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockLogs, total: 15 }),
      })

      const dashboard = useDashboard()
      await dashboard.fetchStats()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(dashboard.recentLogs).toEqual(mockLogs)
      expect(dashboard.requestCount24h).toBe(15)
      expect(dashboard.loadingStats).toBe(false)
    })

    it('handles fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const dashboard = useDashboard()
      await dashboard.fetchStats()

      expect(dashboard.loadingStats).toBe(false)
    })
  })

  describe('startSubscription', () => {
    it('subscribes via transport composable', () => {
      const dashboard = useDashboard()
      dashboard.startSubscription()

      expect(mockTransport.subscribe).toHaveBeenCalledWith(
        'dashboard-activity',
        expect.objectContaining({
          table: 'webhook_logs',
          events: ['INSERT', 'UPDATE'],
          endpointIds: ['ep-1', 'ep-2', 'ep-3'],
        }),
        expect.any(Function),
      )
    })

    it('seeds seen IDs when recentLogs exist', () => {
      const dashboard = useDashboard()
      // Set some recent logs first
      dashboard.recentLogs = [{ id: 'log-1' }, { id: 'log-2' }]
      dashboard.startSubscription()

      expect(mockTransport.seedSeenIds).toHaveBeenCalledWith(['log-1', 'log-2'])
    })

    it('does not seed when recentLogs empty', () => {
      const dashboard = useDashboard()
      dashboard.recentLogs = []
      dashboard.startSubscription()

      expect(mockTransport.seedSeenIds).not.toHaveBeenCalled()
    })

    it('INSERT callback adds enriched log to recentLogs', () => {
      const dashboard = useDashboard()
      dashboard.startSubscription()

      // Get the callback passed to subscribe
      const callback = mockTransport.subscribe.mock.calls[0][2]

      callback('INSERT', {
        id: 'new-log',
        endpoint_id: 'ep-1',
        request_method: 'POST',
      })

      expect(dashboard.recentLogs.length).toBe(1)
      expect(dashboard.recentLogs[0].id).toBe('new-log')
      expect(dashboard.requestCount24h).toBe(1)
    })

    it('UPDATE callback updates existing log', () => {
      const dashboard = useDashboard()
      dashboard.recentLogs = [
        { id: 'log-1', status: 'pending', endpoint_id: 'ep-1' },
      ]
      dashboard.startSubscription()

      const callback = mockTransport.subscribe.mock.calls[0][2]

      callback('UPDATE', {
        id: 'log-1',
        status: 'completed',
        endpoint_id: 'ep-1',
      })

      expect(dashboard.recentLogs[0].status).toBe('completed')
    })

    it('UPDATE callback ignores log not in recentLogs', () => {
      const dashboard = useDashboard()
      dashboard.recentLogs = [{ id: 'log-1', status: 'pending' }]
      dashboard.startSubscription()

      const callback = mockTransport.subscribe.mock.calls[0][2]

      callback('UPDATE', { id: 'unknown', status: 'completed' })

      // No change
      expect(dashboard.recentLogs.length).toBe(1)
      expect(dashboard.recentLogs[0].id).toBe('log-1')
    })
  })

  describe('stopSubscription', () => {
    it('unsubscribes via transport composable', () => {
      const dashboard = useDashboard()
      dashboard.stopSubscription()

      expect(mockTransport.unsubscribe).toHaveBeenCalledWith(
        'dashboard-activity',
      )
    })
  })

  describe('fetchStats with no auth token', () => {
    it('returns early when no auth headers', async () => {
      const authModule = await import('../../../src/stores/auth.js')
      vi.spyOn(authModule, 'useAuthStore').mockReturnValue({
        session: null,
      })

      const dashboard = useDashboard()
      await dashboard.fetchStats()

      expect(global.fetch).not.toHaveBeenCalled()
      expect(dashboard.loadingStats).toBe(false)
    })
  })

  describe('fetchStats non-ok responses', () => {
    it('does not update recentLogs when recentRes is not ok', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'fail' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ total: 5 }),
        })

      const dashboard = useDashboard()
      await dashboard.fetchStats()

      expect(dashboard.recentLogs).toEqual([])
      expect(dashboard.requestCount24h).toBe(5)
    })

    it('does not update requestCount when countRes is not ok', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'log-1' }] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'fail' }),
        })

      const dashboard = useDashboard()
      await dashboard.fetchStats()

      expect(dashboard.recentLogs).toEqual([{ id: 'log-1' }])
    })
  })
})

describe('formatTimeAgo', () => {
  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString()
    expect(formatTimeAgo(now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatTimeAgo(fiveMinAgo)).toBe('5 min ago')
  })

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago', () => {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString()
    expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago')
  })

  it('returns dash for null input', () => {
    expect(formatTimeAgo(null)).toBe('—')
  })
})
