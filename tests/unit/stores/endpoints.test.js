import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEndpointsStore } from '../../../src/stores/endpoints.js'

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      supabaseUrl: 'https://test.supabase.co',
    },
  }),
}))

vi.mock('../../../src/stores/auth.js', () => ({
  useAuthStore: () => ({
    session: { access_token: 'test-token' },
  }),
}))

const mockEndpoint = {
  id: 'ep-1',
  name: 'Test Endpoint',
  slug: 'a1b2c3d4',
  target_url: 'http://localhost',
  target_port: 3000,
  target_path: '/',
  timeout_seconds: 30,
  custom_headers: {},
  is_active: true,
  created_at: '2026-02-09T00:00:00Z',
  updated_at: '2026-02-09T00:00:00Z',
}

describe('Endpoints Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('fetchEndpoints', () => {
    it('fetches and stores endpoints', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [mockEndpoint] }),
      })

      const store = useEndpointsStore()
      const result = await store.fetchEndpoints()

      expect(result.data).toEqual([mockEndpoint])
      expect(store.endpoints).toEqual([mockEndpoint])
      expect(store.loading).toBe(false)
    })

    it('sets error on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })

      const store = useEndpointsStore()
      const result = await store.fetchEndpoints()

      expect(result.error).toBe('Unauthorized')
      expect(store.error).toBe('Unauthorized')
    })

    it('toggles loading state during fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const store = useEndpointsStore()
      const promise = store.fetchEndpoints()
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('createEndpoint', () => {
    it('creates endpoint and adds to list', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockEndpoint }),
      })

      const store = useEndpointsStore()
      const result = await store.createEndpoint({ name: 'Test Endpoint' })

      expect(result.data).toEqual(mockEndpoint)
      expect(store.endpoints).toContainEqual(mockEndpoint)
      expect(global.fetch).toHaveBeenCalledWith('/api/endpoints', {
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({ name: 'Test Endpoint' }),
      })
    })

    it('returns error on validation failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Name is required' }),
      })

      const store = useEndpointsStore()
      const result = await store.createEndpoint({})

      expect(result.error).toBe('Name is required')
    })
  })

  describe('updateEndpoint', () => {
    it('updates endpoint in list', async () => {
      const updated = { ...mockEndpoint, target_port: 8080 }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: updated }),
      })

      const store = useEndpointsStore()
      store.endpoints = [mockEndpoint]
      const result = await store.updateEndpoint('ep-1', { target_port: 8080 })

      expect(result.data).toEqual(updated)
      expect(store.endpoints[0].target_port).toBe(8080)
    })

    it('returns error on update failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ error: 'Port must be between 1 and 65535' }),
      })

      const store = useEndpointsStore()
      const result = await store.updateEndpoint('ep-1', {
        target_port: 99999,
      })

      expect(result.error).toBe('Port must be between 1 and 65535')
    })
  })

  describe('deleteEndpoint', () => {
    it('removes endpoint from list', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Endpoint deleted' }),
      })

      const store = useEndpointsStore()
      store.endpoints = [mockEndpoint]
      const result = await store.deleteEndpoint('ep-1')

      expect(result.data).toBeNull()
      expect(store.endpoints).toHaveLength(0)
    })

    it('returns error on delete failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Endpoint not found' }),
      })

      const store = useEndpointsStore()
      const result = await store.deleteEndpoint('ep-1')

      expect(result.error).toBe('Endpoint not found')
    })
  })

  describe('toggleActive', () => {
    it('optimistically toggles is_active and confirms', async () => {
      const toggled = { ...mockEndpoint, is_active: false }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: toggled }),
      })

      const store = useEndpointsStore()
      store.endpoints = [{ ...mockEndpoint }]
      await store.toggleActive('ep-1')

      expect(store.endpoints[0].is_active).toBe(false)
    })

    it('rolls back on toggle failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      const store = useEndpointsStore()
      store.endpoints = [{ ...mockEndpoint, is_active: true }]
      await store.toggleActive('ep-1')

      expect(store.endpoints[0].is_active).toBe(true)
    })

    it('returns error for non-existent endpoint', async () => {
      const store = useEndpointsStore()
      const result = await store.toggleActive('non-existent')
      expect(result.error).toBe('Endpoint not found')
    })
  })

  describe('getEndpoint', () => {
    it('fetches a single endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockEndpoint }),
      })

      const store = useEndpointsStore()
      const result = await store.getEndpoint('ep-1')

      expect(result.data).toEqual(mockEndpoint)
    })
  })
})
