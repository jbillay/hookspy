import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSupabase } from '../composables/use-supabase.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const profile = ref(null)
  const loading = ref(true)

  let authSubscription = null
  let initPromise = null

  const isAuthenticated = computed(() => !!user.value)
  const plan = computed(() => profile.value?.plan || 'free')
  const role = computed(() => profile.value?.role || 'user')
  const isAdmin = computed(() => role.value === 'admin')

  async function fetchProfile() {
    if (!session.value?.access_token) return

    try {
      const res = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${session.value.access_token}`,
        },
      })

      if (res.status === 401) {
        const body = await res.json()
        if (body.error === 'account_disabled') {
          await signOut()
          return { error: 'account_disabled' }
        }
      }

      if (res.ok) {
        const { data } = await res.json()
        profile.value = data
      }
    } catch {
      // Profile fetch failure is non-fatal
    }

    return { error: null }
  }

  function initAuth() {
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      const { client } = useSupabase()

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(async (event, currentSession) => {
        session.value = currentSession
        user.value = currentSession?.user ?? null

        if (currentSession?.user) {
          await fetchProfile()
        } else {
          profile.value = null
        }

        if (event === 'INITIAL_SESSION') {
          loading.value = false
          resolve()
        }
      })

      authSubscription = subscription
    })

    return initPromise
  }

  async function signUp(email, password) {
    const { client } = useSupabase()
    loading.value = true
    try {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error) return { error }
      user.value = data.user
      session.value = data.session
      if (data.session) {
        await fetchProfile()
      }
      return { data }
    } finally {
      loading.value = false
    }
  }

  async function signIn(email, password) {
    const { client } = useSupabase()
    loading.value = true
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      })
      if (error) return { error }
      user.value = data.user
      session.value = data.session
      await fetchProfile()
      return { data }
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    const { client } = useSupabase()
    loading.value = true
    try {
      const { error } = await client.auth.signOut()
      if (error) return { error }
      user.value = null
      session.value = null
      profile.value = null
      return { error: null }
    } finally {
      loading.value = false
    }
  }

  async function changePassword(currentPassword, newPassword) {
    const { client } = useSupabase()
    const email = user.value?.email
    if (!email) return { error: { message: 'Not authenticated' } }

    // Verify current password by re-authenticating
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (signInError)
      return { error: { message: 'Current password is incorrect' } }

    // Update to new password
    const { data, error } = await client.auth.updateUser({
      password: newPassword,
    })
    if (error) return { error }
    return { data }
  }

  async function deleteAccount() {
    if (!session.value?.access_token)
      return { error: { message: 'Not authenticated' } }

    try {
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.value.access_token}`,
        },
      })

      if (!res.ok) {
        const body = await res.json()
        return { error: { message: body.error || 'Failed to delete account' } }
      }

      user.value = null
      session.value = null
      profile.value = null
      return { data: { success: true } }
    } catch {
      return { error: { message: 'Failed to delete account' } }
    }
  }

  function destroy() {
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }
    initPromise = null
  }

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    plan,
    role,
    isAdmin,
    initAuth,
    fetchProfile,
    signUp,
    signIn,
    signOut,
    changePassword,
    deleteAccount,
    destroy,
  }
})
