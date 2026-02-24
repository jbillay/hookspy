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
        updateUser: vi.fn((...args) => mockAuthMethods.updateUser(...args)),
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
      updateUser: vi.fn(() =>
        Promise.resolve({ data: { user: mockUser }, error: null }),
      ),
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

  describe('changePassword', () => {
    it('changes password when current password is correct', async () => {
      const store = useAuthStore()
      store.user = mockUser
      store.session = mockSession

      const result = await store.changePassword('oldpass', 'newpass123')

      expect(mockAuthMethods.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'oldpass',
      })
      expect(mockAuthMethods.updateUser).toHaveBeenCalledWith({
        password: 'newpass123',
      })
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('returns error when current password is wrong', async () => {
      mockAuthMethods.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      const store = useAuthStore()
      store.user = mockUser
      store.session = mockSession

      const result = await store.changePassword('wrongpass', 'newpass123')

      expect(result.error.message).toBe('Current password is incorrect')
      expect(mockAuthMethods.updateUser).not.toHaveBeenCalled()
    })

    it('returns error when not authenticated', async () => {
      const store = useAuthStore()

      const result = await store.changePassword('old', 'new')

      expect(result.error.message).toBe('Not authenticated')
    })
  })

  describe('deleteAccount', () => {
    it('deletes account and clears state on success', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }),
      )

      const store = useAuthStore()
      store.user = mockUser
      store.session = mockSession
      store.profile = { id: 'user-123' }

      const result = await store.deleteAccount()

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/profile', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-abc' },
      })
      expect(result.data).toEqual({ success: true })
      expect(store.user).toBeNull()
      expect(store.session).toBeNull()
      expect(store.profile).toBeNull()
    })

    it('returns error on failure', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              error: 'Cannot delete the last active admin account',
            }),
        }),
      )

      const store = useAuthStore()
      store.user = mockUser
      store.session = mockSession

      const result = await store.deleteAccount()

      expect(result.error.message).toBe(
        'Cannot delete the last active admin account',
      )
      expect(store.user).toEqual(mockUser)
    })

    it('returns error when not authenticated', async () => {
      const store = useAuthStore()

      const result = await store.deleteAccount()

      expect(result.error.message).toBe('Not authenticated')
    })
  })
})
