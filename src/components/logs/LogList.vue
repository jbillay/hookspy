<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import LogDetail from './LogDetail.vue'
import LogFilters from './LogFilters.vue'
import { useLogs } from '../../composables/use-logs.js'

const props = defineProps({
  endpointId: {
    type: String,
    default: null,
  },
})

const store = useLogs()
const router = useRouter()
const route = useRoute()
const expandedRows = ref({})

const showEndpointColumn = computed(() => !props.endpointId)

// Initialize filters from URL query params
const filters = ref({
  q: route.query.q || '',
  method: route.query.method ? route.query.method.split(',') : [],
  status: route.query.status ? route.query.status.split(',') : [],
  from: route.query.from ? new Date(route.query.from) : null,
  to: route.query.to ? new Date(route.query.to) : null,
})

function buildQueryParams() {
  const params = {}
  if (filters.value.q) params.q = filters.value.q
  if (filters.value.method.length > 0)
    params.method = filters.value.method.join(',')
  if (filters.value.status.length > 0)
    params.status = filters.value.status.join(',')
  if (filters.value.from) params.from = filters.value.from.toISOString()
  if (filters.value.to) params.to = filters.value.to.toISOString()
  return params
}

function onFiltersUpdate(newFilters) {
  const prev = filters.value
  filters.value = newFilters

  // Only call store actions for changed values
  if (newFilters.q !== prev.q) {
    store.setSearchQuery(newFilters.q)
  }
  if (newFilters.method.join(',') !== prev.method.join(',')) {
    store.setMethodFilter(newFilters.method)
  }
  if (newFilters.status.join(',') !== prev.status.join(',')) {
    store.setStatusFilter(newFilters.status)
  }
  if (
    newFilters.from?.toISOString() !== prev.from?.toISOString() ||
    newFilters.to?.toISOString() !== prev.to?.toISOString()
  ) {
    store.setDateRange(newFilters.from, newFilters.to)
  }

  router.replace({ query: buildQueryParams() })
}

function clearFilters() {
  filters.value = { q: '', method: [], status: [], from: null, to: null }
  store.clearAllFilters()
  router.replace({ query: {} })
}

onMounted(async () => {
  if (props.endpointId) {
    await store.setEndpointFilter(props.endpointId)
  } else {
    store.endpointFilter = null
  }

  // Apply URL filters to store before fetching
  if (filters.value.method.length > 0) {
    store.methodFilter = filters.value.method
  }
  if (filters.value.status.length > 0) {
    store.statusFilter = filters.value.status
  }
  if (filters.value.q) {
    store.searchQuery = filters.value.q
  }
  if (filters.value.from) {
    store.dateFrom = filters.value.from
  }
  if (filters.value.to) {
    store.dateTo = filters.value.to
  }

  await store.fetchLogs()
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
    <LogFilters
      :model-value="filters"
      @update:model-value="onFiltersUpdate"
      @clear="clearFilters"
    />

    <div
      v-if="store.loading && store.logs.length === 0"
      class="flex justify-center py-8"
    >
      <ProgressSpinner />
    </div>

    <div
      v-else-if="
        !store.loading && store.logs.length === 0 && store.hasActiveFilters
      "
      class="text-center py-8 text-surface-400"
    >
      <i class="pi pi-filter-slash text-4xl mb-2 block"></i>
      <p>No logs match your filters</p>
      <a
        href="#"
        class="text-primary text-sm mt-1 inline-block"
        @click.prevent="clearFilters"
        >Clear filters</a
      >
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
        <Column field="status" header="Status" style="width: 10rem">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <Tag
                :value="statusLabel(data.status)"
                :severity="statusSeverity(data.status)"
                :class="{ 'status-pulse': data.status === 'forwarding' }"
              />
              <i
                v-if="data.replayed_from"
                class="pi pi-replay text-blue-500"
                title="Replayed webhook"
              />
            </div>
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
