import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth.js'
import { useEndpointsStore } from './endpoints.js'
import { useSupabase } from '../composables/use-supabase.js'

export const useLogsStore = defineStore('logs', () => {
  const logs = ref([])
  const loading = ref(false)
  const error = ref(null)
  const totalCount = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(50)
  const endpointFilter = ref(null)
  const channel = ref(null)

  function getAuthHeaders() {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async function fetchLogs() {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({
        page: String(currentPage.value),
        limit: String(pageSize.value),
      })
      if (endpointFilter.value) {
        params.set('endpoint_id', endpointFilter.value)
      }
      const res = await fetch(`/api/logs?${params}`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        error.value = json.error || 'Failed to fetch logs'
        return { error: error.value }
      }
      logs.value = json.data
      totalCount.value = json.total
      return { data: json.data }
    } catch (err) {
      error.value = err.message
      return { error: error.value }
    } finally {
      loading.value = false
    }
  }

  function setEndpointFilter(id) {
    endpointFilter.value = id
    currentPage.value = 1
    return fetchLogs()
  }

  function setPage(page) {
    currentPage.value = page
    return fetchLogs()
  }

  function startSubscription() {
    const endpointsStore = useEndpointsStore()
    const ids = endpointFilter.value
      ? [endpointFilter.value]
      : endpointsStore.endpoints.map((e) => e.id)

    if (ids.length === 0) return

    const filterStr = `endpoint_id=in.(${ids.join(',')})`
    const { client } = useSupabase()

    const ch = client
      .channel('log-viewer')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs',
          filter: filterStr,
        },
        (payload) => {
          if (currentPage.value === 1) {
            logs.value.unshift(payload.new)
            totalCount.value++
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'webhook_logs',
          filter: filterStr,
        },
        (payload) => {
          const idx = logs.value.findIndex((l) => l.id === payload.new.id)
          if (idx !== -1) {
            logs.value[idx] = { ...logs.value[idx], ...payload.new }
          }
        },
      )
      .subscribe()

    channel.value = ch
  }

  function stopSubscription() {
    if (channel.value) {
      const { client } = useSupabase()
      client.removeChannel(channel.value)
      channel.value = null
    }
  }

  return {
    logs,
    loading,
    error,
    totalCount,
    currentPage,
    pageSize,
    endpointFilter,
    fetchLogs,
    setEndpointFilter,
    setPage,
    startSubscription,
    stopSubscription,
  }
})
