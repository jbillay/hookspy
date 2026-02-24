<script setup>
import { onMounted } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import AdminLayout from '../components/admin/AdminLayout.vue'
import AdminStats from '../components/admin/AdminStats.vue'
import { useAdminStore } from '../stores/admin.js'

const adminStore = useAdminStore()

onMounted(() => {
  adminStore.fetchStats()
  adminStore.fetchAuditLog({ limit: 10 })
})

function formatTimestamp(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString()
}

function actionLabel(action) {
  return action.replace('_', ' ')
}
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-neutral-900 mb-6">Dashboard</h1>

    <div
      v-if="adminStore.loading && !adminStore.stats"
      class="flex justify-center py-16"
    >
      <ProgressSpinner />
    </div>

    <AdminStats v-else :stats="adminStore.stats" />

    <!-- Recent Audit Log -->
    <div class="mt-8">
      <h2 class="text-lg font-semibold text-neutral-900 mb-4">
        Recent Admin Activity
      </h2>
      <DataTable
        :value="adminStore.auditLog"
        :loading="adminStore.loading"
        class="text-sm"
        striped-rows
      >
        <Column field="admin_email" header="Admin" />
        <Column field="target_email" header="Target User" />
        <Column field="action" header="Action">
          <template #body="{ data }">
            <Tag
              :value="actionLabel(data.action)"
              :severity="data.action === 'status_change' ? 'warning' : 'info'"
              class="text-xs"
            />
          </template>
        </Column>
        <Column header="Details">
          <template #body="{ data }">
            <span class="text-xs text-neutral-500">
              {{ JSON.stringify(data.old_value) }} →
              {{ JSON.stringify(data.new_value) }}
            </span>
          </template>
        </Column>
        <Column field="created_at" header="When">
          <template #body="{ data }">
            {{ formatTimestamp(data.created_at) }}
          </template>
        </Column>
      </DataTable>
    </div>
  </AdminLayout>
</template>
