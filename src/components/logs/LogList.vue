<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import LogDetail from './LogDetail.vue'
import { useLogs } from '../../composables/use-logs.js'

const props = defineProps({
  endpointId: {
    type: String,
    default: null,
  },
})

const store = useLogs()
const expandedRows = ref({})

const showEndpointColumn = computed(() => !props.endpointId)

onMounted(async () => {
  if (props.endpointId) {
    await store.setEndpointFilter(props.endpointId)
  } else {
    await store.setEndpointFilter(null)
  }
  store.startSubscription()
})

onUnmounted(() => {
  store.stopSubscription()
})

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

function statusLabel(status) {
  const map = {
    pending: 'Pending',
    forwarding: 'Forwarding...',
    responded: 'Responded',
    timeout: 'Timeout',
    error: 'Error',
  }
  return map[status] || status
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

function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString()
}

function onPageChange(event) {
  store.setPage(Math.floor(event.first / store.pageSize) + 1)
}
</script>

<template>
  <div>
    <div
      v-if="store.loading && store.logs.length === 0"
      class="flex justify-center py-8"
    >
      <ProgressSpinner />
    </div>

    <div
      v-else-if="!store.loading && store.logs.length === 0"
      class="text-center py-8 text-surface-400"
    >
      <i class="pi pi-inbox text-4xl mb-2 block"></i>
      <p>No webhook logs yet</p>
    </div>

    <template v-else>
      <DataTable
        v-model:expanded-rows="expandedRows"
        :value="store.logs"
        data-key="id"
        :row-hover="true"
        class="log-table"
      >
        <Column expander style="width: 3rem" />
        <Column field="received_at" header="Time" style="width: 8rem">
          <template #body="{ data }">
            <span class="text-sm">{{ formatTime(data.received_at) }}</span>
          </template>
        </Column>
        <Column
          v-if="showEndpointColumn"
          field="endpoint_name"
          header="Endpoint"
          style="width: 10rem"
        >
          <template #body="{ data }">
            <span class="text-sm font-medium">{{ data.endpoint_name }}</span>
          </template>
        </Column>
        <Column field="request_method" header="Method" style="width: 6rem">
          <template #body="{ data }">
            <Tag
              :value="data.request_method"
              :severity="methodSeverity(data.request_method)"
            />
          </template>
        </Column>
        <Column field="request_url" header="URL">
          <template #body="{ data }">
            <span class="text-sm font-mono truncate block max-w-xs">{{
              data.request_url
            }}</span>
          </template>
        </Column>
        <Column field="status" header="Status" style="width: 8rem">
          <template #body="{ data }">
            <Tag
              :value="statusLabel(data.status)"
              :severity="statusSeverity(data.status)"
              :class="{ 'status-pulse': data.status === 'forwarding' }"
            />
          </template>
        </Column>
        <Column field="duration_ms" header="Duration" style="width: 6rem">
          <template #body="{ data }">
            <span class="text-sm">{{ formatDuration(data.duration_ms) }}</span>
          </template>
        </Column>
        <template #expansion="slotProps">
          <LogDetail :log="slotProps.data" />
        </template>
      </DataTable>

      <Paginator
        v-if="store.totalCount > store.pageSize"
        :rows="store.pageSize"
        :total-records="store.totalCount"
        :first="(store.currentPage - 1) * store.pageSize"
        class="mt-2"
        @page="onPageChange"
      />
    </template>
  </div>
</template>

<style>
@keyframes pulse-status {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-pulse {
  animation: pulse-status 1.5s ease-in-out infinite;
}
</style>
