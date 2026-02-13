import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

  // Filter state
  const methodFilter = ref([])
  const statusFilter = ref([])
  const searchQuery = ref('')
  const dateFrom = ref(null)
  const dateTo = ref(null)

  const hasActiveFilters = computed(
    () =>
      methodFilter.value.length > 0 ||
      statusFilter.value.length > 0 ||
      searchQuery.value !== '' ||
      dateFrom.value !== null ||
      dateTo.value !== null,
  )

  function getAuthHeaders() {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    if (!token) return null
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  function matchesFilters(log) {
    if (
      methodFilter.value.length > 0 &&
      !methodFilter.value.includes(log.request_method)
    ) {
      return false
    }
    if (
      statusFilter.value.length > 0 &&
      !statusFilter.value.includes(log.status)
    ) {
      return false
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const fields = [
        log.request_body,
        log.request_url,
        log.response_body,
        log.error_message,
      ]
      const matches = fields.some(
        (f) => f && String(f).toLowerCase().includes(q),
      )
      if (!matches) return false
    }
    return true
  }

  async function fetchLogs() {
    const headers = getAuthHeaders()
    if (!headers) {
      return { error: 'Not authenticated' }
    }
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
      if (methodFilter.value.length > 0) {
        params.set('method', methodFilter.value.join(','))
      }
      if (statusFilter.value.length > 0) {
        params.set('status', statusFilter.value.join(','))
      }
      if (dateFrom.value) {
        params.set('from', dateFrom.value.toISOString())
      }
      if (dateTo.value) {
        params.set('to', dateTo.value.toISOString())
      }
      if (searchQuery.value) {
        params.set('q', searchQuery.value)
      }
      const res = await fetch(`/api/logs?${params}`, {
        headers,
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

  function setMethodFilter(methods) {
    methodFilter.value = methods
    currentPage.value = 1
    return fetchLogs()
  }

  function setStatusFilter(statuses) {
    statusFilter.value = statuses
    currentPage.value = 1
    return fetchLogs()
  }

  function setSearchQuery(query) {
    searchQuery.value = query
    currentPage.value = 1
    return fetchLogs()
  }

  function setDateRange(from, to) {
    dateFrom.value = from
    dateTo.value = to
    currentPage.value = 1
    return fetchLogs()
  }

  function clearAllFilters() {
    methodFilter.value = []
    statusFilter.value = []
    searchQuery.value = ''
    dateFrom.value = null
    dateTo.value = null
    currentPage.value = 1
    return fetchLogs()
  }

  async function replayLog(logId) {
    const headers = getAuthHeaders()
    if (!headers) {
      return { error: 'Not authenticated' }
    }
    try {
      const res = await fetch(`/api/logs/${logId}/replay`, {
        method: 'POST',
        headers,
      })
      const json = await res.json()
      if (!res.ok) {
        return { error: json.error || 'Failed to replay webhook' }
      }
      return { data: json.data }
    } catch (err) {
      return { error: err.message }
    }
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
          totalCount.value++
          if (currentPage.value === 1 && matchesFilters(payload.new)) {
            logs.value.unshift(payload.new)
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
    methodFilter,
    statusFilter,
    searchQuery,
    dateFrom,
    dateTo,
    hasActiveFilters,
    fetchLogs,
    setEndpointFilter,
    setPage,
    setMethodFilter,
    setStatusFilter,
    setSearchQuery,
    setDateRange,
    clearAllFilters,
    replayLog,
    startSubscription,
    stopSubscription,
  }
})
