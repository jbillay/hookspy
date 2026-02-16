<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import LogDetail from './LogDetail.vue'
import LogFilters from './LogFilters.vue'
import { useLogs } from '../../composables/use-logs.js'
import { useEndpoints } from '../../composables/use-endpoints.js'

const props = defineProps({
  endpointId: {
    type: String,
    default: null,
  },
})

const store = useLogs()
const endpointsStore = useEndpoints()
const router = useRouter()
const route = useRoute()
const expandedRows = ref({})

const showEndpointColumn = computed(() => !props.endpointId)

// Initialize filters from URL query params
const filters = ref({
  q: route.query.q || '',
  method: route.query.method ? route.query.method.split(',') : [],
  status: route.query.status ? route.query.status.split(',') : [],
  endpointIds: route.query.endpointIds
    ? route.query.endpointIds.split(',')
    : [],
  from: null,
  to: null,
})

function cleanUrl(url) {
  if (!url) return '--'
  try {
    const idx = url.indexOf('?')
    return idx !== -1 ? url.substring(0, idx) : url
  } catch {
    return url
  }
}

function buildQueryParams() {
  const params = {}
  if (filters.value.q) params.q = filters.value.q
  if (filters.value.method.length > 0)
    params.method = filters.value.method.join(',')
  if (filters.value.status.length > 0)
    params.status = filters.value.status.join(',')
  if (filters.value.endpointIds.length > 0)
    params.endpointIds = filters.value.endpointIds.join(',')
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
  if (newFilters.endpointIds.join(',') !== prev.endpointIds.join(',')) {
    if (newFilters.endpointIds.length > 0) {
      store.setEndpointFilter(newFilters.endpointIds)
    } else {
      store.endpointFilter = null
      store.fetchLogs()
    }
  }

  router.replace({ query: buildQueryParams() })
}

function clearFilters() {
  filters.value = {
    q: '',
    method: [],
    status: [],
    endpointIds: [],
    from: null,
    to: null,
  }
  store.clearAllFilters()
  router.replace({ query: {} })
}

onMounted(async () => {
  // Fetch endpoints for the filter dropdown (only on global logs page)
  if (!props.endpointId) {
    endpointsStore.fetchEndpoints()
  }

  if (props.endpointId) {
    await store.setEndpointFilter(props.endpointId)
  } else if (filters.value.endpointIds.length > 0) {
    store.endpointFilter = filters.value.endpointIds
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

  await store.fetchLogs()
  store.startSubscription()
})

onUnmounted(() => {
  store.stopSubscription()
})

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

function methodBadgeClass(method) {
  return `badge-method badge-method-${method?.toLowerCase() || 'get'}`
}

function formatDuration(ms) {
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(ts) {
  if (!ts) return '--'
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
      :endpoints="!endpointId ? endpointsStore.endpoints : []"
      @update:model-value="onFiltersUpdate"
      @clear="clearFilters"
    />

    <div
      v-if="store.loading && store.logs.length === 0"
      class="flex justify-center py-12"
    >
      <ProgressSpinner />
    </div>

    <div
      v-else-if="
        !store.loading && store.logs.length === 0 && store.hasActiveFilters
      "
      class="text-center py-12"
    >
      <div
        class="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-neutral-100"
      >
        <i class="pi pi-filter-slash text-xl text-neutral-400" />
      </div>
      <p class="text-sm text-neutral-500">No logs match your filters</p>
      <a
        href="#"
        class="text-sm mt-2 inline-block font-medium no-underline"
        style="color: var(--hs-brand)"
        @click.prevent="clearFilters"
        >Clear filters</a
      >
    </div>

    <div
      v-else-if="!store.loading && store.logs.length === 0"
      class="text-center py-12"
    >
      <div
        class="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-neutral-100"
      >
        <i class="pi pi-inbox text-xl text-neutral-400" />
      </div>
      <p class="text-sm text-neutral-500">No webhook logs yet</p>
    </div>

    <template v-else>
      <div class="card-surface overflow-hidden">
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
              <span class="text-sm text-neutral-600">{{
                formatTime(data.received_at)
              }}</span>
            </template>
          </Column>
          <Column
            v-if="showEndpointColumn"
            field="endpoint_name"
            header="Endpoint"
            style="width: 10rem"
          >
            <template #body="{ data }">
              <span class="text-sm font-medium text-neutral-800">{{
                data.endpoint_name
              }}</span>
            </template>
          </Column>
          <Column field="request_method" header="Method" style="width: 6rem">
            <template #body="{ data }">
              <span :class="methodBadgeClass(data.request_method)">
                {{ data.request_method }}
              </span>
            </template>
          </Column>
          <Column field="request_url" header="URL">
            <template #body="{ data }">
              <span
                class="text-sm font-code text-neutral-600 truncate block max-w-xs"
                >{{ cleanUrl(data.request_url) }}</span
              >
            </template>
          </Column>
          <Column field="status" header="Status" style="width: 10rem">
            <template #body="{ data }">
              <div class="flex items-center gap-1.5">
                <span
                  :class="[
                    statusConfig(data.status).dot,
                    data.status === 'forwarding' ? 'animate-pulse' : '',
                  ]"
                />
                <span class="text-sm text-neutral-600">{{
                  statusConfig(data.status).label
                }}</span>
                <i
                  v-if="data.replayed_from"
                  class="pi pi-replay text-xs text-blue-500"
                  title="Replayed webhook"
                />
              </div>
            </template>
          </Column>
          <Column field="duration_ms" header="Duration" style="width: 6rem">
            <template #body="{ data }">
              <span class="text-sm text-neutral-500 font-code">{{
                formatDuration(data.duration_ms)
              }}</span>
            </template>
          </Column>
          <template #expansion="slotProps">
            <LogDetail :log="slotProps.data" />
          </template>
        </DataTable>
      </div>

      <Paginator
        v-if="store.totalCount > store.pageSize"
        :rows="store.pageSize"
        :total-records="store.totalCount"
        :first="(store.currentPage - 1) * store.pageSize"
        class="mt-4"
        @page="onPageChange"
      />
    </template>
  </div>
</template>
