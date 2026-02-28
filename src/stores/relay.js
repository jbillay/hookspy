import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSupabase } from '../composables/use-supabase.js'
import { useRealtimeTransport } from '../composables/use-realtime-transport.js'
import { useAuthStore } from './auth.js'
import { useEndpointsStore } from './endpoints.js'

const FORBIDDEN_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
])

const FORBIDDEN_HEADER_PREFIXES = ['proxy-', 'sec-']

function buildTargetUrl(endpoint) {
  return `${endpoint.target_url}:${endpoint.target_port}${endpoint.target_path}`
}

function filterHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {}
  const filtered = {}
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    if (FORBIDDEN_HEADERS.has(lower)) continue
    if (FORBIDDEN_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix)))
      continue
    filtered[key] = value
  }
  return filtered
}

function classifyError(err, url) {
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
      return `CORS error: ${url} — Enable CORS on your local server`
    }
    return `Connection refused: ${url}`
  }
  return `Network error: ${err.message}`
}

export const useRelayStore = defineStore('relay', () => {
  const forwardingCount = ref(0)
  const lastError = ref(null)
  const subscribed = ref(false)

  const transport = useRealtimeTransport()

  const relayStatus = computed(() => {
    const endpointsStore = useEndpointsStore()
    const hasActive = endpointsStore.endpoints.some((e) => e.is_active)
    if (!hasActive && endpointsStore.endpoints.length > 0) return 'no-endpoints'
    if (!subscribed.value) return 'inactive'
    if (transport.isConnected.value) return 'active'
    return 'inactive'
  })

  async function startRelay() {
    const endpointsStore = useEndpointsStore()
    const activeEndpoints = endpointsStore.endpoints.filter((e) => e.is_active)

    if (activeEndpoints.length === 0) {
      subscribed.value = false
      return
    }

    const ids = activeEndpoints.map((e) => e.id)
    console.log('[relay-worker] subscribing with endpoints:', ids.length)

    transport.subscribe(
      'relay-worker',
      {
        table: 'webhook_logs',
        events: ['INSERT'],
        endpointIds: ids,
      },
      (eventType, row) => {
        if (row && row.status === 'pending') {
          forwardWebhook(row)
        }
      },
    )

    subscribed.value = true
  }

  async function stopRelay() {
    transport.unsubscribe('relay-worker')
    subscribed.value = false
  }

  async function updateSubscription() {
    const endpointsStore = useEndpointsStore()
    const activeEndpoints = endpointsStore.endpoints.filter((e) => e.is_active)

    if (activeEndpoints.length === 0) {
      await stopRelay()
      return
    }

    const ids = activeEndpoints.map((e) => e.id)

    if (subscribed.value) {
      transport.updateSubscription('relay-worker', {
        table: 'webhook_logs',
        events: ['INSERT'],
        endpointIds: ids,
      })
    } else {
      await startRelay()
    }
  }

  async function forwardWebhook(log) {
    const { client } = useSupabase()

    // Step 1: Claim webhook (optimistic locking)
    const { data: claimed, error: claimError } = await client
      .from('webhook_logs')
      .update({ status: 'forwarding' })
      .eq('id', log.id)
      .eq('status', 'pending')
      .select()

    if (claimError || !claimed || claimed.length === 0) {
      return // Another tab already claimed it
    }

    // Step 2: Look up endpoint config
    const endpointsStore = useEndpointsStore()
    const endpoint = endpointsStore.endpoints.find(
      (e) => e.id === log.endpoint_id,
    )
    if (!endpoint) {
      await submitError(log.id, `Endpoint not found: ${log.endpoint_id}`)
      return
    }

    // Step 3: Build target URL and headers (append sub-path if present)
    let url = buildTargetUrl(endpoint)
    if (log.request_subpath) {
      url = url.replace(/\/$/, '') + log.request_subpath
    }
    const filteredHeaders = filterHeaders(log.request_headers)
    const mergedHeaders = {
      ...filteredHeaders,
      ...(endpoint.custom_headers || {}),
    }

    forwardingCount.value++
    try {
      // Step 4: Forward to localhost
      const response = await fetch(url, {
        method: log.request_method,
        headers: mergedHeaders,
        body: ['GET', 'HEAD'].includes(log.request_method?.toUpperCase())
          ? undefined
          : log.request_body,
        mode: 'cors',
      })

      // Step 5: Capture and submit response
      const responseHeaders = Object.fromEntries(response.headers.entries())
      const responseBody = await response.text()

      await submitResponse(log.id, {
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      })

      lastError.value = null
    } catch (err) {
      // Step 6: Classify and report error
      const errorMessage = classifyError(err, url)
      lastError.value = errorMessage
      await submitError(log.id, errorMessage)
    } finally {
      forwardingCount.value--
    }
  }

  async function submitResponse(logId, responseData) {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    try {
      await fetch(`/api/logs/${logId}/response`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responseData),
      })
    } catch (err) {
      console.error('Failed to submit relay response:', err)
    }
  }

  async function submitError(logId, errorMessage) {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    try {
      await fetch(`/api/logs/${logId}/response`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: errorMessage }),
      })
    } catch (err) {
      console.error('Failed to submit relay error:', err)
    }
  }

  return {
    relayStatus,
    forwardingCount,
    lastError,
    startRelay,
    stopRelay,
    updateSubscription,
    forwardWebhook,
    buildTargetUrl,
    filterHeaders,
  }
})
