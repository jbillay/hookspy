import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../../src/stores/auth.js'

const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockSession = { access_token: 'token-abc', user: mockUser }

let mockAuthMethods

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      auth: {
        onAuthStateChange: (callback) => {
          mockAuthMethods.onAuthStateChange = callback
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        },
        signUp: vi.fn((...args) => mockAuthMethods.signUp(...args)),
        signInWithPassword: vi.fn((...args) =>
          mockAuthMethods.signInWithPassword(...args),
        ),
        signOut: vi.fn(() => mockAuthMethods.signOut()),
      },
    },
  }),
}))

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthMethods = {
      onAuthStateChange: null,
      signUp: vi.fn(() =>
        Promise.resolve({
          data: { user: mockUser, session: mockSession },
          error: null,
        }),
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({
          data: { user: mockUser, session: mockSession },
          error: null,
        }),
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    }
  })

  describe('initAuth', () => {
    it('sets loading to false after INITIAL_SESSION', async () => {
      const store = useAuthStore()
      expect(store.loading).toBe(true)

      const promise = store.initAuth()
      mockAuthMethods.onAuthStateChange('INITIAL_SESSION', null)
      await promise

      expect(store.loading).toBe(false)
    })

    it('restores session from INITIAL_SESSION event', async () => {
      const store = useAuthStore()
      const promise = store.initAuth()
      mockAuthMethods.onAuthStateChange('INITIAL_SESSION', mockSession)
      await promise

      expect(store.user).toEqual(mockUser)
      expect(store.session).toEqual(mockSession)
      expect(store.isAuthenticated).toBe(true)
    })

    it('sets user to null when no session exists', async () => {
      const store = useAuthStore()
      const promise = store.initAuth()
      mockAuthMethods.onAuthStateChange('INITIAL_SESSION', null)
      await promise

      expect(store.user).toBeNull()
      expect(store.session).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('updates store on SIGNED_IN event', async () => {
      const store = useAuthStore()
      const promise = store.initAuth()
      mockAuthMethods.onAuthStateChange('INITIAL_SESSION', null)
      await promise

      mockAuthMethods.onAuthStateChange('SIGNED_IN', mockSession)

      expect(store.user).toEqual(mockUser)
      expect(store.isAuthenticated).toBe(true)
    })

    it('updates store on SIGNED_OUT event', async () => {
      const store = useAuthStore()
      const promise = store.initAuth()
      mockAuthMethods.onAuthStateChange('INITIAL_SESSION', mockSession)
      await promise

      mockAuthMethods.onAuthStateChange('SIGNED_OUT', null)

      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('signUp', () => {
    it('sets user and session on success', async () => {
      const store = useAuthStore()
      const result = await store.signUp('test@example.com', 'password123')

      expect(result.error).toBeUndefined()
      expect(store.user).toEqual(mockUser)
      expect(store.session).toEqual(mockSession)
    })

    it('returns error on failure', async () => {
      mockAuthMethods.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      })

      const store = useAuthStore()
      const result = await store.signUp('test@example.com', 'password123')

      expect(result.error.message).toBe('User already registered')
      expect(store.user).toBeNull()
    })

    it('toggles loading state during request', async () => {
      const store = useAuthStore()
      store.loading = false

      const promise = store.signUp('test@example.com', 'password123')
      expect(store.loading).toBe(true)

      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('signIn', () => {
    it('sets user and session on success', async () => {
      const store = useAuthStore()
      const result = await store.signIn('test@example.com', 'password123')

      expect(result.error).toBeUndefined()
      expect(store.user).toEqual(mockUser)
      expect(store.session).toEqual(mockSession)
    })

    it('returns error on invalid credentials', async () => {
      mockAuthMethods.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      const store = useAuthStore()
      const result = await store.signIn('test@example.com', 'wrong')

      expect(result.error.message).toBe('Invalid login credentials')
      expect(store.user).toBeNull()
    })

    it('toggles loading state during request', async () => {
      const store = useAuthStore()
      store.loading = false

      const promise = store.signIn('test@example.com', 'password123')
      expect(store.loading).toBe(true)

      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('signOut', () => {
    it('clears user and session state', async () => {
      const store = useAuthStore()
      store.user = mockUser
      store.session = mockSession

      await store.signOut()

      expect(store.user).toBeNull()
      expect(store.session).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('toggles loading state during request', async () => {
      const store = useAuthStore()
      store.loading = false

      const promise = store.signOut()
      expect(store.loading).toBe(true)

      await promise
      expect(store.loading).toBe(false)
    })
  })
})
