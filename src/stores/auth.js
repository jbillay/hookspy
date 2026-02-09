import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSupabase } from '../composables/use-supabase.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const loading = ref(true)

  let authSubscription = null
  let initPromise = null

  const isAuthenticated = computed(() => !!user.value)

  function initAuth() {
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      const { client } = useSupabase()

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, currentSession) => {
        session.value = currentSession
        user.value = currentSession?.user ?? null

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
      return { error: null }
    } finally {
      loading.value = false
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
    loading,
    isAuthenticated,
    initAuth,
    signUp,
    signIn,
    signOut,
    destroy,
  }
})
