import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  formatTimeAgo,
  useDashboard,
} from '../../../src/composables/use-dashboard.js'

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
      { id: 'ep-3', is_active: true },
    ],
  }),
}))

describe('useDashboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    global.fetch = vi.fn()
    mockClient.removeChannel.mockClear()
    mockClient.channel.mockClear()
    mockChannel.on.mockClear().mockReturnThis()
    mockChannel.subscribe.mockClear().mockReturnThis()
  })

  describe('computed properties', () => {
    it('returns correct endpoint counts', () => {
      const dashboard = useDashboard()
      expect(dashboard.totalEndpoints.value).toBe(3)
      expect(dashboard.activeEndpoints.value).toBe(2)
      expect(dashboard.inactiveEndpoints.value).toBe(1)
      expect(dashboard.hasEndpoints.value).toBe(true)
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
      expect(dashboard.recentLogs.value).toEqual(mockLogs)
      expect(dashboard.requestCount24h.value).toBe(15)
      expect(dashboard.loadingStats.value).toBe(false)
    })

    it('handles fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const dashboard = useDashboard()
      await dashboard.fetchStats()

      expect(dashboard.loadingStats.value).toBe(false)
    })
  })

  describe('startSubscription', () => {
    it('creates Realtime channel with correct filter', () => {
      const dashboard = useDashboard()
      dashboard.startSubscription()

      expect(mockClient.channel).toHaveBeenCalledWith('dashboard-activity')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs',
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
  })

  describe('stopSubscription', () => {
    it('removes channel when one exists', () => {
      const dashboard = useDashboard()
      dashboard.startSubscription()
      dashboard.stopSubscription()

      expect(mockClient.removeChannel).toHaveBeenCalled()
    })

    it('does nothing when no channel exists', () => {
      const dashboard = useDashboard()
      dashboard.stopSubscription()

      expect(mockClient.removeChannel).not.toHaveBeenCalled()
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
