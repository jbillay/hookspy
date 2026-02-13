<script setup>
import { ref } from 'vue'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import PayloadViewer from './PayloadViewer.vue'
import { useLogs } from '../../composables/use-logs.js'

const props = defineProps({
  log: {
    type: Object,
    required: true,
  },
})

const store = useLogs()
const toast = useToast()
const replayLoading = ref(false)

const terminalStatuses = ['responded', 'timeout', 'error']

async function handleReplay() {
  replayLoading.value = true
  const { error } = await store.replayLog(props.log.id)
  replayLoading.value = false
  if (error) {
    toast.add({
      severity: 'error',
      summary: 'Replay Failed',
      detail: error,
      life: 5000,
    })
  } else {
    toast.add({
      severity: 'success',
      summary: 'Replayed',
      detail: 'Webhook replayed',
      life: 3000,
    })
  }
}

function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function methodSeverity(method) {
  const map = {
    GET: 'info',
    POST: 'success',
    PUT: 'warn',
    PATCH: 'warn',
    DELETE: 'danger',
    HEAD: 'secondary',
    OPTIONS: 'secondary',
  }
  return map[method?.toUpperCase()] || 'secondary'
}

function statusCodeSeverity(code) {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 400 && code < 500) return 'warn'
  if (code >= 500) return 'danger'
  return 'info'
}
</script>

<template>
  <div class="p-4">
    <div class="flex items-center gap-4 mb-4 text-sm text-surface-600">
      <span>Received: {{ formatTimestamp(log.received_at) }}</span>
      <span v-if="log.responded_at"
        >Responded: {{ formatTimestamp(log.responded_at) }}</span
      >
      <span v-if="log.duration_ms != null"
        >Duration: {{ formatDuration(log.duration_ms) }}</span
      >
      <Tag
        v-if="log.replayed_from"
        value="Replay"
        severity="info"
        icon="pi pi-replay"
      />
      <div class="ml-auto">
        <Button
          v-if="terminalStatuses.includes(log.status)"
          label="Replay"
          icon="pi pi-replay"
          severity="secondary"
          text
          size="small"
          :loading="replayLoading"
          @click="handleReplay"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- Request -->
      <div>
        <h4 class="text-sm font-semibold mb-3 text-surface-700">Request</h4>
        <div class="flex items-center gap-2 mb-3">
          <Tag
            :value="log.request_method"
            :severity="methodSeverity(log.request_method)"
          />
          <span class="text-sm font-mono text-surface-600 break-all">{{
            log.request_url
          }}</span>
        </div>

        <div v-if="log.request_headers" class="mb-3">
          <div class="text-xs font-semibold text-surface-500 mb-1">Headers</div>
          <div class="text-xs font-mono space-y-0.5">
            <div
              v-for="(value, key) in log.request_headers"
              :key="key"
              class="flex gap-1"
            >
              <span class="text-surface-600 font-semibold">{{ key }}:</span>
              <span class="text-surface-500 break-all">{{ value }}</span>
            </div>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold text-surface-500 mb-1">Body</div>
          <PayloadViewer :content="log.request_body" />
        </div>
      </div>

      <!-- Response -->
      <div>
        <h4 class="text-sm font-semibold mb-3 text-surface-700">Response</h4>

        <template v-if="log.status === 'responded'">
          <div class="flex items-center gap-2 mb-3">
            <Tag
              :value="String(log.response_status)"
              :severity="statusCodeSeverity(log.response_status)"
            />
          </div>

          <div v-if="log.response_headers" class="mb-3">
            <div class="text-xs font-semibold text-surface-500 mb-1">
              Headers
            </div>
            <div class="text-xs font-mono space-y-0.5">
              <div
                v-for="(value, key) in log.response_headers"
                :key="key"
                class="flex gap-1"
              >
                <span class="text-surface-600 font-semibold">{{ key }}:</span>
                <span class="text-surface-500 break-all">{{ value }}</span>
              </div>
            </div>
          </div>

          <div>
            <div class="text-xs font-semibold text-surface-500 mb-1">Body</div>
            <PayloadViewer :content="log.response_body" />
          </div>
        </template>

        <div
          v-else-if="log.status === 'timeout'"
          class="p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700"
        >
          No response — timed out
        </div>

        <div
          v-else-if="log.status === 'error'"
          class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"
        >
          {{ log.error_message }}
        </div>

        <div
          v-else
          class="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700"
        >
          Waiting for response...
        </div>
      </div>
    </div>
  </div>
</template>
