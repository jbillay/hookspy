import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

describe('useSupabase', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a client object', async () => {
    const { useSupabase } =
      await import('../../../src/composables/use-supabase')
    const { client } = useSupabase()
    expect(client).toBeDefined()
    expect(client).not.toBeNull()
  })

  it('returns the same client instance on subsequent calls', async () => {
    const { useSupabase } =
      await import('../../../src/composables/use-supabase')
    const { client: client1 } = useSupabase()
    const { client: client2 } = useSupabase()
    expect(client1).toBe(client2)
  })
})
