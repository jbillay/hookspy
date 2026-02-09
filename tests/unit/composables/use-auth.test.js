import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuth } from '../../../src/composables/use-auth.js'
import { useAuthStore } from '../../../src/stores/auth.js'

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
    },
  }),
}))

describe('useAuth composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns the auth store instance', () => {
    const auth = useAuth()
    const store = useAuthStore()
    expect(auth).toBe(store)
  })

  it('exposes reactive state properties', () => {
    const auth = useAuth()
    expect(auth).toHaveProperty('user')
    expect(auth).toHaveProperty('session')
    expect(auth).toHaveProperty('loading')
    expect(auth).toHaveProperty('isAuthenticated')
  })

  it('exposes auth action methods', () => {
    const auth = useAuth()
    expect(typeof auth.signIn).toBe('function')
    expect(typeof auth.signUp).toBe('function')
    expect(typeof auth.signOut).toBe('function')
    expect(typeof auth.initAuth).toBe('function')
  })
})
