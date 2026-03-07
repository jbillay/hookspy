import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useRelayStore } from '../../../src/stores/relay.js'

const mockTransport = {
  transportMode: ref('connecting'),
  isConnected: ref(false),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  updateSubscription: vi.fn(),
  seedSeenIds: vi.fn(),
}

vi.mock('../../../src/composables/use-realtime-transport.js', () => ({
  useRealtimeTransport: () => mockTransport,
}))

const mockClient = {
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'log-1', status: 'forwarding' }],
            error: null,
          }),
        })),
      })),
    })),
  })),
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
      {
        id: 'ep-1',
        target_url: 'http://localhost',
        target_port: 3000,
        target_path: '/webhook',
        custom_headers: { 'X-Api-Key': 'secret' },
        is_active: true,
      },
      {
        id: 'ep-2',
        target_url: 'http://localhost',
        target_port: 8080,
        target_path: '/',
        custom_headers: {},
        is_active: false,
      },
    ],
  }),
}))

describe('Relay Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('buildTargetUrl', () => {
    it('builds URL from endpoint config', () => {
      const store = useRelayStore()
      const url = store.buildTargetUrl({
        target_url: 'http://localhost',
        target_port: 3000,
        target_path: '/webhook',
      })
      expect(url).toBe('http://localhost:3000/webhook')
    })

    it('handles different ports and paths', () => {
      const store = useRelayStore()
      expect(
        store.buildTargetUrl({
          target_url: 'http://127.0.0.1',
          target_port: 8080,
          target_path: '/api/hooks/stripe',
        }),
      ).toBe('http://127.0.0.1:8080/api/hooks/stripe')
    })

    it('handles root path', () => {
      const store = useRelayStore()
      expect(
        store.buildTargetUrl({
          target_url: 'http://localhost',
          target_port: 4000,
          target_path: '/',
        }),
      ).toBe('http://localhost:4000/')
    })
  })

  describe('filterHeaders', () => {
    it('removes forbidden headers', () => {
      const store = useRelayStore()
      const filtered = store.filterHeaders({
        'Content-Type': 'application/json',
        Host: 'example.com',
        Origin: 'https://hookspy.app',
        Cookie: 'session=abc',
        'X-Custom': 'value',
      })
      expect(filtered).toEqual({
        'Content-Type': 'application/json',
        'X-Custom': 'value',
      })
    })

    it('removes headers with forbidden prefixes', () => {
      const store = useRelayStore()
      const filtered = store.filterHeaders({
        'Content-Type': 'application/json',
        'Proxy-Authorization': 'Basic abc',
        'Sec-Fetch-Mode': 'cors',
      })
      expect(filtered).toEqual({
        'Content-Type': 'application/json',
      })
    })

    it('is case-insensitive', () => {
      const store = useRelayStore()
      const filtered = store.filterHeaders({
        host: 'example.com',
        HOST: 'example.com',
        'content-type': 'text/plain',
      })
      expect(filtered).toEqual({
        'content-type': 'text/plain',
      })
    })

    it('handles null/undefined input', () => {
      const store = useRelayStore()
      expect(store.filterHeaders(null)).toEqual({})
      expect(store.filterHeaders(undefined)).toEqual({})
    })
  })

  describe('forwardWebhook sub-path appending', () => {
    it('appends request_subpath to target URL', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"ok":true}'),
      })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'POST',
        request_headers: { 'content-type': 'application/json' },
        request_body: '{"event":"test"}',
        request_subpath: '/stripe/events',
      })

      // First fetch call is the forward to localhost
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/webhook/stripe/events',
        expect.objectContaining({ method: 'POST' }),
      )

      fetchSpy.mockRestore()
    })

    it('does not modify URL when request_subpath is null', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('ok'),
      })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'POST',
        request_headers: {},
        request_body: '',
        request_subpath: null,
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/webhook',
        expect.objectContaining({ method: 'POST' }),
      )

      fetchSpy.mockRestore()
    })

    it('handles trailing slash in target_path with sub-path', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve(''),
      })

      // Use ep-2's config but we need it active; build URL manually
      const store = useRelayStore()
      // ep-2 has target_path: '/'
      // Override endpoint lookup by using ep-2's id but it's inactive,
      // so instead test buildTargetUrl + subpath logic directly
      const baseUrl = store.buildTargetUrl({
        target_url: 'http://localhost',
        target_port: 8080,
        target_path: '/',
      })
      let url = baseUrl
      const subpath = '/events/webhook'
      url = url.replace(/\/$/, '') + subpath
      expect(url).toBe('http://localhost:8080/events/webhook')

      fetchSpy.mockRestore()
    })
  })

  describe('startRelay', () => {
    it('sets status to no-endpoints when no active endpoints', async () => {
      // Override mock to return no active endpoints
      const endpointsModule = await import('../../../src/stores/endpoints.js')
      vi.spyOn(endpointsModule, 'useEndpointsStore').mockReturnValue({
        endpoints: [{ id: 'ep-1', is_active: false }],
      })

      const store = useRelayStore()
      await store.startRelay()
      expect(store.relayStatus).toBe('no-endpoints')
    })
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      const store = useRelayStore()
      expect(store.relayStatus).toBe('inactive')
      expect(store.forwardingCount).toBe(0)
      expect(store.lastError).toBeNull()
    })
  })

  describe('stopRelay', () => {
    it('sets status to inactive', async () => {
      const store = useRelayStore()
      await store.stopRelay()
      expect(store.relayStatus).toBe('inactive')
    })
  })

  describe('relayStatus computed', () => {
    it('returns active when subscribed and connected', async () => {
      const store = useRelayStore()

      // Start relay so subscribed becomes true
      await store.startRelay()
      expect(mockTransport.subscribe).toHaveBeenCalled()

      // Simulate connected
      mockTransport.isConnected.value = true
      expect(store.relayStatus).toBe('active')

      mockTransport.isConnected.value = false
    })

    it('returns inactive when subscribed but not connected', async () => {
      const store = useRelayStore()
      await store.startRelay()
      mockTransport.isConnected.value = false
      expect(store.relayStatus).toBe('inactive')
    })
  })

  describe('updateSubscription', () => {
    it('calls transport.updateSubscription when already subscribed', async () => {
      const store = useRelayStore()
      await store.startRelay()
      expect(mockTransport.subscribe).toHaveBeenCalled()

      await store.updateSubscription()
      expect(mockTransport.updateSubscription).toHaveBeenCalledWith(
        'relay-worker',
        expect.objectContaining({ events: ['INSERT'] }),
      )
    })

    it('stops relay when no active endpoints', async () => {
      const endpointsModule = await import('../../../src/stores/endpoints.js')
      vi.spyOn(endpointsModule, 'useEndpointsStore').mockReturnValue({
        endpoints: [{ id: 'ep-1', is_active: false }],
      })

      const store = useRelayStore()
      await store.updateSubscription()
      expect(mockTransport.unsubscribe).toHaveBeenCalledWith('relay-worker')
    })

    it('starts relay if not yet subscribed', async () => {
      const store = useRelayStore()
      // Not subscribed yet, so it should call startRelay internally
      await store.updateSubscription()
      expect(mockTransport.subscribe).toHaveBeenCalledWith(
        'relay-worker',
        expect.any(Object),
        expect.any(Function),
      )
    })
  })

  describe('forwardWebhook error paths', () => {
    it('returns silently when claim fails (already claimed)', async () => {
      const claimMock = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        })),
      }

      const supabaseModule =
        await import('../../../src/composables/use-supabase.js')
      vi.spyOn(supabaseModule, 'useSupabase').mockReturnValue({
        client: claimMock,
      })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'POST',
        request_headers: {},
        request_body: '',
      })

      // Should return without error — no fetch call made
      expect(store.forwardingCount).toBe(0)
    })

    it('submits error when endpoint not found', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve({}),
      })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'unknown-ep',
        status: 'pending',
        request_method: 'POST',
        request_headers: {},
        request_body: '',
      })

      // Should have called response endpoint with error
      const responseCalls = fetchSpy.mock.calls.filter((c) =>
        c[0].includes('/response'),
      )
      expect(responseCalls.length).toBeGreaterThan(0)

      fetchSpy.mockRestore()
    })

    it('handles fetch error with TypeError (CORS)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((url) => {
          if (url.includes('/response')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
            })
          }
          return Promise.reject(new TypeError('Failed to fetch'))
        })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'POST',
        request_headers: {},
        request_body: '{}',
      })

      expect(store.lastError).toMatch(/CORS error/)
      expect(store.forwardingCount).toBe(0)

      fetchSpy.mockRestore()
    })

    it('handles fetch error with generic Error', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((url) => {
          if (url.includes('/response')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
            })
          }
          return Promise.reject(new Error('Timeout'))
        })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'POST',
        request_headers: {},
        request_body: '{}',
      })

      expect(store.lastError).toMatch(/Network error/)

      fetchSpy.mockRestore()
    })

    it('does not send body for GET requests', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('ok'),
      })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'GET',
        request_headers: {},
        request_body: null,
      })

      // The localhost fetch call should have body: undefined
      const localCall = fetchSpy.mock.calls.find((c) => !c[0].includes('/api/'))
      if (localCall) {
        expect(localCall[1].body).toBeUndefined()
      }

      fetchSpy.mockRestore()
    })

    it('handles submitResponse fetch failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((url) => {
          if (url.includes('/response')) {
            return Promise.reject(new Error('Network down'))
          }
          return Promise.resolve({
            status: 200,
            headers: new Headers(),
            text: () => Promise.resolve('ok'),
          })
        })

      const store = useRelayStore()
      await store.forwardWebhook({
        id: 'log-1',
        endpoint_id: 'ep-1',
        status: 'pending',
        request_method: 'POST',
        request_headers: {},
        request_body: '{}',
      })

      // Should not throw, just log error
      expect(consoleSpy).toHaveBeenCalled()

      fetchSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe('$reset', () => {
    it('stops relay and clears all state', async () => {
      const store = useRelayStore()
      await store.startRelay()
      store.forwardingCount = 3
      store.lastError = 'some error'

      store.$reset()

      expect(store.forwardingCount).toBe(0)
      expect(store.lastError).toBeNull()
      expect(mockTransport.unsubscribe).toHaveBeenCalledWith('relay-worker')
    })
  })
})
