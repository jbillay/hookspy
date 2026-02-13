import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useEndpointsStore } from '../stores/endpoints.js'
import { useSupabase } from './use-supabase.js'

const recentLogs = ref([])
const requestCount24h = ref(0)
const loadingStats = ref(false)
const channel = ref(null)

console.log('[dashboard module] initialized, recentLogs:', recentLogs.value.length)

export function formatTimeAgo(timestamp) {
  if (!timestamp) return '—'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function useDashboard() {
  const endpointsStore = useEndpointsStore()

  const totalEndpoints = computed(() => endpointsStore.endpoints.length)
  const activeEndpoints = computed(
    () => endpointsStore.endpoints.filter((e) => e.is_active).length,
  )
  const inactiveEndpoints = computed(
    () => endpointsStore.endpoints.filter((e) => !e.is_active).length,
  )
  const hasEndpoints = computed(() => totalEndpoints.value > 0)

  function getAuthHeaders() {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    if (!token) return null
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async function fetchStats() {
    loadingStats.value = true
    console.log('[dashboard] fetchStats start, recentLogs length:', recentLogs.value.length)
    try {
      const headers = getAuthHeaders()
      if (!headers) {
        console.log('[dashboard] no auth headers, bailing')
        return
      }
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString()

      const [recentRes, countRes] = await Promise.all([
        fetch('/api/logs?limit=5&page=1', { headers }),
        fetch(`/api/logs?limit=1&from=${twentyFourHoursAgo}`, { headers }),
      ])

      const recentJson = await recentRes.json()
      const countJson = await countRes.json()

      console.log('[dashboard] recentRes.ok:', recentRes.ok, 'data length:', recentJson.data?.length, 'raw:', JSON.stringify(recentJson).substring(0, 200))

      if (recentRes.ok) {
        recentLogs.value = recentJson.data || []
      }
      console.log('[dashboard] after set, recentLogs length:', recentLogs.value.length)
      if (countRes.ok) {
        requestCount24h.value = countJson.total || 0
      }
    } catch (err) {
      console.error('[dashboard] fetchStats error:', err)
    } finally {
      loadingStats.value = false
      console.log('[dashboard] fetchStats done, recentLogs length:', recentLogs.value.length)
    }
  }

  function startSubscription() {
    const ids = endpointsStore.endpoints.map((e) => e.id)
    if (ids.length === 0) return

    const filterStr = `endpoint_id=in.(${ids.join(',')})`
    const { client } = useSupabase()

    const ch = client
      .channel('dashboard-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs',
          filter: filterStr,
        },
        (payload) => {
          console.log('[dashboard] Realtime INSERT event:', JSON.stringify(payload).substring(0, 200))
          const ep = endpointsStore.endpoints.find(
            (e) => e.id === payload.new.endpoint_id,
          )
          const enriched = {
            ...payload.new,
            endpoint_name: ep?.name || 'Unknown',
            endpoint_slug: ep?.slug,
          }
          recentLogs.value = [enriched, ...recentLogs.value].slice(0, 10)
          requestCount24h.value++
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
          const idx = recentLogs.value.findIndex((l) => l.id === payload.new.id)
          if (idx !== -1) {
            recentLogs.value[idx] = {
              ...recentLogs.value[idx],
              ...payload.new,
            }
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
    recentLogs,
    requestCount24h,
    loadingStats,
    totalEndpoints,
    activeEndpoints,
    inactiveEndpoints,
    hasEndpoints,
    fetchStats,
    startSubscription,
    stopSubscription,
  }
}
