<script setup>
import { ref } from 'vue'
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
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTimestamp(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString()
}

function methodBadgeClass(method) {
  return `badge-method badge-method-${method?.toLowerCase() || 'get'}`
}

function statusCodeClass(code) {
  if (code >= 200 && code < 300) return 'text-green-600 bg-green-50'
  if (code >= 400 && code < 500) return 'text-amber-600 bg-amber-50'
  if (code >= 500) return 'text-red-600 bg-red-50'
  return 'text-blue-600 bg-blue-50'
}
</script>

<template>
  <div class="p-5 bg-neutral-50">
    <!-- Meta row -->
    <div
      class="flex flex-wrap items-center gap-4 mb-5 text-xs text-neutral-500"
    >
      <span>Received: {{ formatTimestamp(log.received_at) }}</span>
      <span v-if="log.responded_at"
        >Responded: {{ formatTimestamp(log.responded_at) }}</span
      >
      <span v-if="log.duration_ms != null"
        >Duration:
        <span class="font-code font-medium">{{
          formatDuration(log.duration_ms)
        }}</span></span
      >
      <span
        v-if="log.replayed_from"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-xs font-medium"
      >
        <i class="pi pi-replay text-xs" /> Replay
      </span>
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

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Request -->
      <div class="card-surface p-4">
        <h4
          class="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3"
        >
          Request
        </h4>
        <div class="flex items-center gap-2 mb-3">
          <span :class="methodBadgeClass(log.request_method)">
            {{ log.request_method }}
          </span>
          <span class="text-sm font-code text-neutral-600 break-all">{{
            log.request_url
          }}</span>
        </div>

        <div v-if="log.request_headers" class="mb-3">
          <div
            class="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5"
          >
            Headers
          </div>
          <div class="text-xs font-code space-y-0.5">
            <div
              v-for="(value, key) in log.request_headers"
              :key="key"
              class="flex gap-1"
            >
              <span class="text-neutral-600 font-semibold">{{ key }}:</span>
              <span class="text-neutral-500 break-all">{{ value }}</span>
            </div>
          </div>
        </div>

        <div>
          <div
            class="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5"
          >
            Body
          </div>
          <PayloadViewer :content="log.request_body" />
        </div>
      </div>

      <!-- Response -->
      <div class="card-surface p-4">
        <h4
          class="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3"
        >
          Response
        </h4>

        <template v-if="log.status === 'responded'">
          <div class="flex items-center gap-2 mb-3">
            <span
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold font-code',
                statusCodeClass(log.response_status),
              ]"
            >
              {{ log.response_status }}
            </span>
          </div>

          <div v-if="log.response_headers" class="mb-3">
            <div
              class="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5"
            >
              Headers
            </div>
            <div class="text-xs font-code space-y-0.5">
              <div
                v-for="(value, key) in log.response_headers"
                :key="key"
                class="flex gap-1"
              >
                <span class="text-neutral-600 font-semibold">{{ key }}:</span>
                <span class="text-neutral-500 break-all">{{ value }}</span>
              </div>
            </div>
          </div>

          <div>
            <div
              class="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1.5"
            >
              Body
            </div>
            <PayloadViewer :content="log.response_body" />
          </div>
        </template>

        <div
          v-else-if="log.status === 'timeout'"
          class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700"
        >
          No response -- timed out
        </div>

        <div
          v-else-if="log.status === 'error'"
          class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          {{ log.error_message }}
        </div>

        <div
          v-else
          class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2"
        >
          <div
            class="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
          />
          Waiting for response...
        </div>
      </div>
    </div>
  </div>
</template>
