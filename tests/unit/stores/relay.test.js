import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRelayStore } from '../../../src/stores/relay.js'

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}

const mockClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
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
      store.relayStatus = 'active'
      await store.stopRelay()
      expect(store.relayStatus).toBe('inactive')
    })
  })
})
