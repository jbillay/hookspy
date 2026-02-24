<script setup>
import { ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import PlanBadge from '../settings/PlanBadge.vue'
import UserActions from './UserActions.vue'

defineProps({
  users: { type: Array, default: () => [] },
  pagination: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['search', 'filter', 'page', 'refresh'])

const searchQuery = ref('')
const planFilter = ref(null)
const statusFilter = ref(null)

let debounceTimer = null

const planOptions = [
  { label: 'All Plans', value: null },
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
]

const statusOptions = [
  { label: 'All Statuses', value: null },
  { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' },
]

function onSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit('search', {
      search: searchQuery.value,
      plan: planFilter.value,
      status: statusFilter.value,
    })
  }, 300)
}

function onFilterChange() {
  emit('filter', {
    search: searchQuery.value,
    plan: planFilter.value,
    status: statusFilter.value,
  })
}

function onPage(event) {
  emit('page', { page: Math.floor(event.first / event.rows) + 1 })
}

function formatDate(date) {
  if (!date) return '--'
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <div>
    <!-- Filters -->
    <div class="card-surface p-4 mb-4 flex flex-wrap gap-3 items-end">
      <div class="flex-1 min-w-48">
        <label class="text-xs font-medium text-neutral-500 mb-1 block"
          >Search by email</label
        >
        <InputText
          v-model="searchQuery"
          placeholder="user@example.com"
          class="w-full"
          @input="onSearch"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-500 mb-1 block"
          >Plan</label
        >
        <Select
          v-model="planFilter"
          :options="planOptions"
          option-label="label"
          option-value="value"
          class="w-36"
          @change="onFilterChange"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-500 mb-1 block"
          >Status</label
        >
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          class="w-40"
          @change="onFilterChange"
        />
      </div>
    </div>

    <!-- Table -->
    <DataTable :value="users" :loading="loading" class="text-sm" striped-rows>
      <Column field="email" header="Email" />
      <Column field="plan" header="Plan">
        <template #body="{ data }">
          <PlanBadge :plan="data.plan" />
        </template>
      </Column>
      <Column field="role" header="Role">
        <template #body="{ data }">
          <Tag
            v-if="data.role === 'admin'"
            value="Admin"
            severity="warning"
            class="text-xs"
          />
          <span v-else class="text-neutral-500 text-xs">User</span>
        </template>
      </Column>
      <Column field="endpoints_count" header="Endpoints" />
      <Column field="status" header="Status">
        <template #body="{ data }">
          <Tag
            :value="data.status"
            :severity="data.status === 'active' ? 'success' : 'danger'"
            class="text-xs"
          />
        </template>
      </Column>
      <Column field="created_at" header="Joined">
        <template #body="{ data }">
          {{ formatDate(data.created_at) }}
        </template>
      </Column>
      <Column header="Actions">
        <template #body="{ data }">
          <UserActions :user="data" @refresh="emit('refresh')" />
        </template>
      </Column>
    </DataTable>

    <!-- Pagination -->
    <Paginator
      v-if="pagination.total > pagination.limit"
      :rows="pagination.limit"
      :total-records="pagination.total"
      :first="(pagination.page - 1) * pagination.limit"
      class="mt-4"
      @page="onPage"
    />
  </div>
</template>
