<script setup>
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/admin/AdminLayout.vue'
import UserTable from '../components/admin/UserTable.vue'
import { useAdminStore } from '../stores/admin.js'

const adminStore = useAdminStore()
const filters = ref({})

onMounted(() => {
  adminStore.fetchUsers()
})

function handleSearch(params) {
  filters.value = { ...filters.value, ...params }
  adminStore.fetchUsers({ ...filters.value, page: 1 })
}

function handleFilter(params) {
  filters.value = { ...filters.value, ...params }
  adminStore.fetchUsers({ ...filters.value, page: 1 })
}

function handlePage({ page }) {
  adminStore.fetchUsers({ ...filters.value, page })
}

function handleRefresh() {
  adminStore.fetchUsers(filters.value)
}
</script>

<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold text-neutral-900 mb-6">Users</h1>

    <UserTable
      :users="adminStore.users"
      :pagination="adminStore.usersPagination"
      :loading="adminStore.loading"
      @search="handleSearch"
      @filter="handleFilter"
      @page="handlePage"
      @refresh="handleRefresh"
    />
  </AdminLayout>
</template>
