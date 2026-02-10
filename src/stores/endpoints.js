import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth.js'

export const useEndpointsStore = defineStore('endpoints', () => {
  const endpoints = ref([])
  const loading = ref(false)
  const error = ref(null)

  function getAuthHeaders() {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async function fetchEndpoints() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/endpoints', {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || 'Failed to fetch endpoints'
        return { error: error.value }
      }
      endpoints.value = json.data
      return { data: json.data }
    } catch (err) {
      error.value = err.message
      return { error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function createEndpoint(payload) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || 'Failed to create endpoint'
        return { error: error.value }
      }
      endpoints.value.push(json.data)
      return { data: json.data }
    } catch (err) {
      error.value = err.message
      return { error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function updateEndpoint(id, payload) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/endpoints/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || 'Failed to update endpoint'
        return { error: error.value }
      }
      const idx = endpoints.value.findIndex((e) => e.id === id)
      if (idx !== -1) {
        endpoints.value[idx] = json.data
      }
      return { data: json.data }
    } catch (err) {
      error.value = err.message
      return { error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function deleteEndpoint(id) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/endpoints/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || 'Failed to delete endpoint'
        return { error: error.value }
      }
      endpoints.value = endpoints.value.filter((e) => e.id !== id)
      return { data: null }
    } catch (err) {
      error.value = err.message
      return { error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function toggleActive(id) {
    const endpoint = endpoints.value.find((e) => e.id === id)
    if (!endpoint) return { error: 'Endpoint not found' }

    const previousValue = endpoint.is_active
    endpoint.is_active = !previousValue

    const result = await updateEndpoint(id, { is_active: !previousValue })
    if (result.error) {
      endpoint.is_active = previousValue
    }
    return result
  }

  async function getEndpoint(id) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/endpoints/${id}`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || 'Endpoint not found'
        return { error: error.value }
      }
      return { data: json.data }
    } catch (err) {
      error.value = err.message
      return { error: error.value }
    } finally {
      loading.value = false
    }
  }

  return {
    endpoints,
    loading,
    error,
    fetchEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    toggleActive,
    getEndpoint,
  }
})
