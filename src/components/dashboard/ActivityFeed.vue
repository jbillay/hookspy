<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatTimeAgo } from '../../composables/use-dashboard.js'

defineProps({
  logs: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const timeNow = ref(Date.now())
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    timeNow.value = Date.now()
  }, 60000)
})

onUnmounted(() => {
  clearInterval(timer)
})

function methodBadgeClass(method) {
  const m = method?.toUpperCase()
  return `badge-method badge-method-${m?.toLowerCase() || 'get'}`
}

function statusConfig(status) {
  const map = {
    pending: { dot: 'status-dot-pending', label: 'Pending' },
    forwarding: { dot: 'status-dot-pending', label: 'Forwarding' },
    responded: { dot: 'status-dot-active', label: 'OK' },
    timeout: { dot: 'status-dot bg-amber-500', label: 'Timeout' },
    error: { dot: 'status-dot-error', label: 'Error' },
  }
  return map[status] || { dot: 'status-dot-inactive', label: status }
}

function goToLogs() {
  router.push({ name: 'logs' })
}
</script>

<template>
  <div class="card-surface">
    <!-- Loading -->
    <div v-if="loading && logs.length === 0" class="flex justify-center py-12">
      <div
        class="w-5 h-5 border-2 border-neutral-200 border-t-brand rounded-full animate-spin"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && logs.length === 0"
      class="text-center py-12 px-6"
    >
      <div
        class="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-neutral-100"
      >
        <i class="pi pi-inbox text-xl text-neutral-400" />
      </div>
      <p class="text-sm text-neutral-500">No recent activity</p>
      <p class="text-xs text-neutral-400 mt-1">
        Incoming webhooks will appear here
      </p>
    </div>

    <!-- Feed list -->
    <div v-else>
      <div
        v-for="(log, index) in logs"
        :key="log.id"
        :class="[
          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-neutral-50',
          index < logs.length - 1 ? 'border-b border-neutral-100' : '',
        ]"
        @click="goToLogs"
      >
        <!-- Method badge -->
        <span :class="methodBadgeClass(log.request_method)">
          {{ log.request_method }}
        </span>

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-neutral-800 truncate">
            {{ log.endpoint_name || 'Unknown' }}
          </div>
          <div class="text-xs text-neutral-400 mt-0.5">
            {{ timeNow && formatTimeAgo(log.received_at) }}
          </div>
        </div>

        <!-- Status -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span :class="statusConfig(log.status).dot" />
          <span class="text-xs text-neutral-500">{{
            statusConfig(log.status).label
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
