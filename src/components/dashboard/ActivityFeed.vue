<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
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

function statusSeverity(status) {
  const map = {
    pending: 'info',
    forwarding: 'info',
    responded: 'success',
    timeout: 'warn',
    error: 'danger',
  }
  return map[status] || 'secondary'
}

function goToLogs() {
  router.push({ name: 'logs' })
}
</script>

<template>
  <div>
    <div v-if="loading && logs.length === 0" class="flex justify-center py-8">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="!loading && logs.length === 0"
      class="text-center py-8 text-surface-400"
    >
      <i class="pi pi-inbox text-4xl mb-2 block"></i>
      <p>No recent activity</p>
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="log in logs"
        :key="log.id"
        class="flex items-center justify-between p-3 rounded hover:bg-surface-50 cursor-pointer transition-colors"
        @click="goToLogs"
      >
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-surface-700 truncate">
            {{ log.endpoint_name || 'Unknown' }}
          </div>
          <div class="text-xs text-surface-400">
            <!-- timeNow forces re-render every 60s -->
            {{ timeNow && formatTimeAgo(log.received_at) }}
          </div>
        </div>
        <div class="flex items-center gap-2 ml-3">
          <Tag
            :value="log.request_method"
            :severity="methodSeverity(log.request_method)"
            class="text-xs"
          />
          <Tag
            :value="log.status"
            :severity="statusSeverity(log.status)"
            class="text-xs"
          />
        </div>
      </div>
    </div>
  </div>
</template>
