import { ref } from 'vue'
import { useSupabase } from './use-supabase.js'

// Module-level singleton state (shared across all consumers)
const transportMode = ref('connecting') // 'connecting' | 'ws' | 'poll'
const isConnected = ref(false)
const subscriptions = new Map() // name → { config, callback, channel }
const appLoadTime = new Date().toISOString()

// Failure detection state (sliding window)
let failureCount = 0
let failureWindowStart = 0
const FAILURE_THRESHOLD = 3
const FAILURE_WINDOW_MS = 30000

// Polling state
let pollIntervalId = null
let lastPollTime = null
const POLL_INTERVAL_MS = 2000

// Reconnect probe state
let probeIntervalId = null
const PROBE_INTERVAL_MS = 60000
const PROBE_TIMEOUT_MS = 10000

// Deduplication state
const seenIds = new Set()
const MAX_SEEN_IDS = 100

function getClient() {
  return useSupabase().client
}

async function getAccessToken() {
  const client = getClient()
  const {
    data: { session },
  } = await client.auth.getSession()
  return session?.access_token
}

// --- Deduplication ---

function isDuplicate(id) {
  if (seenIds.has(id)) return true
  seenIds.add(id)
  if (seenIds.size > MAX_SEEN_IDS) {
    const first = seenIds.values().next().value
    seenIds.delete(first)
  }
  return false
}

function clearSeenIds() {
  seenIds.clear()
}

function seedSeenIds(ids) {
  if (!Array.isArray(ids)) return
  for (const id of ids) {
    seenIds.add(id)
    if (seenIds.size > MAX_SEEN_IDS) {
      const first = seenIds.values().next().value
      seenIds.delete(first)
    }
  }
}

// --- Channel status handling ---

function handleChannelStatus(status) {
  if (status === 'SUBSCRIBED') {
    failureCount = 0
    failureWindowStart = 0
    transportMode.value = 'ws'
    isConnected.value = true
    return
  }

  if (
    status === 'CHANNEL_ERROR' ||
    status === 'TIMED_OUT' ||
    status === 'CLOSED'
  ) {
    const now = Date.now()

    // Start new window if expired or first failure
    if (
      failureWindowStart === 0 ||
      now - failureWindowStart > FAILURE_WINDOW_MS
    ) {
      failureWindowStart = now
      failureCount = 1
    } else {
      failureCount++
    }

    console.log(
      `[transport] WS failure #${failureCount}/${FAILURE_THRESHOLD} (status: ${status})`,
    )

    if (failureCount >= FAILURE_THRESHOLD) {
      console.log(
        '[transport] Persistent WS failure detected, switching to polling',
      )
      switchToPolling()
    }
  }
}

// --- WebSocket mode ---

function createWsChannel(name, config, callback) {
  const client = getClient()
  const filterStr = `endpoint_id=in.(${config.endpointIds.join(',')})`

  const ch = client.channel(name)

  for (const event of config.events) {
    ch.on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table: config.table || 'webhook_logs',
        filter: filterStr,
      },
      (payload) => {
        callback(payload.eventType, payload.new)
      },
    )
  }

  ch.subscribe((status, err) => {
    console.log(`[transport] channel ${name} status:`, status, err || '')
    handleChannelStatus(status)
  })

  return ch
}

// --- Polling mode ---

function switchToPolling() {
  transportMode.value = 'poll'
  failureCount = 0
  failureWindowStart = 0
  clearSeenIds()

  // Remove all WS channels
  const client = getClient()
  for (const [, sub] of subscriptions) {
    if (sub.channel) {
      client.removeChannel(sub.channel)
      sub.channel = null
    }
  }

  // Start polling loop
  if (pollIntervalId) clearInterval(pollIntervalId)
  pollIntervalId = setInterval(pollTick, POLL_INTERVAL_MS)

  // Run first poll immediately
  pollTick()

  // Start reconnect probe
  startReconnectProbe()
}

async function pollTick() {
  // Collect all unique endpoint IDs across subscriptions
  const allIds = new Set()
  for (const [, sub] of subscriptions) {
    if (sub.config.endpointIds) {
      for (const id of sub.config.endpointIds) {
        allIds.add(id)
      }
    }
  }

  if (allIds.size === 0) return // FR-012: skip if no endpoints

  const since = lastPollTime || appLoadTime
  const idsParam = Array.from(allIds).join(',')

  try {
    const token = await getAccessToken()
    if (!token) {
      isConnected.value = false
      return
    }

    const response = await fetch(
      `/api/poll?since=${encodeURIComponent(since)}&endpoint_ids=${idsParam}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (response.status === 401) {
      // Try to refresh session
      const client = getClient()
      const { data } = await client.auth.getSession()
      if (!data.session) {
        console.warn('[transport] Session expired, stopping polling')
        isConnected.value = false
        stopPolling()
        return
      }
      // Session refreshed, retry next tick
      return
    }

    if (!response.ok) {
      console.error('[transport] Poll error:', response.status)
      isConnected.value = false
      return
    }

    const data = await response.json()
    lastPollTime = data.server_time
    isConnected.value = true

    // Dispatch inserts
    if (data.inserts) {
      for (const row of data.inserts) {
        if (isDuplicate(row.id)) continue
        dispatchEvent('INSERT', row)
      }
    }

    // Dispatch updates
    if (data.updates) {
      for (const row of data.updates) {
        if (isDuplicate(row.id)) continue
        dispatchEvent('UPDATE', row)
      }
    }
  } catch (err) {
    console.error('[transport] Poll fetch error:', err)
    isConnected.value = false
  }
}

function dispatchEvent(eventType, row) {
  for (const [, sub] of subscriptions) {
    if (!sub.config.events.includes(eventType)) continue
    if (!sub.config.endpointIds.includes(row.endpoint_id)) continue
    try {
      sub.callback(eventType, row)
    } catch (err) {
      console.error('[transport] Callback error:', err)
    }
  }
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
  stopReconnectProbe()
}

// --- Reconnect probe ---

function startReconnectProbe() {
  if (probeIntervalId) return
  probeIntervalId = setInterval(probeWebSocket, PROBE_INTERVAL_MS)
}

function stopReconnectProbe() {
  if (probeIntervalId) {
    clearInterval(probeIntervalId)
    probeIntervalId = null
  }
}

async function probeWebSocket() {
  const client = getClient()
  let probeChannel = null
  let probeTimeout = null
  let resolved = false

  try {
    probeChannel = client.channel('transport-probe')

    const probePromise = new Promise((resolve) => {
      probeTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(false)
        }
      }, PROBE_TIMEOUT_MS)

      probeChannel.subscribe((status) => {
        if (resolved) return
        if (status === 'SUBSCRIBED') {
          resolved = true
          resolve(true)
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          resolved = true
          resolve(false)
        }
      })
    })

    const success = await probePromise
    clearTimeout(probeTimeout)

    // Clean up probe channel
    await client.removeChannel(probeChannel)

    if (success) {
      console.log('[transport] WS probe succeeded, switching back to WebSocket')
      switchToWebSocket()
    }
  } catch (err) {
    console.error('[transport] Probe error:', err)
    if (probeChannel) {
      try {
        await client.removeChannel(probeChannel)
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

// --- Switch to WebSocket ---

function switchToWebSocket() {
  stopPolling()
  clearSeenIds()
  lastPollTime = null
  transportMode.value = 'connecting'
  isConnected.value = false

  const client = getClient()

  // Recreate WS channels for all subscriptions
  for (const [name, sub] of subscriptions) {
    if (sub.config.endpointIds.length === 0) continue
    if (sub.channel) {
      client.removeChannel(sub.channel)
    }
    sub.channel = createWsChannel(name, sub.config, sub.callback)
  }
}

// --- Public API ---

function subscribe(name, config, callback) {
  // Unsubscribe existing if re-subscribing
  if (subscriptions.has(name)) {
    unsubscribe(name)
  }

  const sub = { config, callback, channel: null }

  if (config.endpointIds.length === 0) {
    // No endpoints — register but don't create channel or poll
    subscriptions.set(name, sub)
    return
  }

  subscriptions.set(name, sub)

  if (transportMode.value === 'connecting' || transportMode.value === 'ws') {
    // Create WS channel
    sub.channel = createWsChannel(name, config, callback)
  }
  // In poll mode, just register — polling loop picks up on next tick
}

function unsubscribe(name) {
  const sub = subscriptions.get(name)
  if (!sub) return

  if (sub.channel) {
    const client = getClient()
    client.removeChannel(sub.channel)
  }

  subscriptions.delete(name)

  // If no subscriptions left, clean up
  if (subscriptions.size === 0) {
    stopPolling()
    isConnected.value = false
  }
}

function updateSubscription(name, newConfig) {
  const sub = subscriptions.get(name)
  if (!sub) return

  sub.config = newConfig

  if (transportMode.value === 'ws' || transportMode.value === 'connecting') {
    // Tear down old channel and create new one with updated filters
    if (sub.channel) {
      const client = getClient()
      client.removeChannel(sub.channel)
      sub.channel = null
    }
    if (newConfig.endpointIds.length > 0) {
      sub.channel = createWsChannel(name, newConfig, sub.callback)
    }
  }
  // In poll mode, the polling loop will pick up new endpointIds on next tick
}

function destroy() {
  stopPolling()
  const client = getClient()
  for (const [, sub] of subscriptions) {
    if (sub.channel) {
      client.removeChannel(sub.channel)
    }
  }
  subscriptions.clear()
  clearSeenIds()
  lastPollTime = null
  failureCount = 0
  failureWindowStart = 0
  transportMode.value = 'connecting'
  isConnected.value = false
}

export function useRealtimeTransport() {
  return {
    transportMode,
    isConnected,
    subscribe,
    unsubscribe,
    updateSubscription,
    seedSeenIds,
    destroy,
  }
}
