import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth.js'

export const useAdminStore = defineStore('admin', () => {
  const users = ref([])
  const usersPagination = ref({ page: 1, limit: 20, total: 0, pages: 0 })
  const stats = ref(null)
  const auditLog = ref([])
  const auditPagination = ref({ page: 1, limit: 50, total: 0, pages: 0 })
  const loading = ref(false)

  function authHeaders() {
    const authStore = useAuthStore()
    return {
      Authorization: `Bearer ${authStore.session?.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  async function fetchUsers(params = {}) {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (params.page) query.set('page', params.page)
      if (params.limit) query.set('limit', params.limit)
      if (params.search) query.set('search', params.search)
      if (params.plan) query.set('plan', params.plan)
      if (params.status) query.set('status', params.status)
      if (params.sort) query.set('sort', params.sort)
      if (params.order) query.set('order', params.order)

      const res = await fetch(`/api/admin/users?${query}`, {
        headers: authHeaders(),
      })

      if (!res.ok) {
        const { error } = await res.json()
        return { error: error || 'Failed to fetch users' }
      }

      const { data, pagination } = await res.json()
      users.value = data
      usersPagination.value = pagination
      return { data }
    } finally {
      loading.value = false
    }
  }

  async function fetchUserDetail(id) {
    const res = await fetch(`/api/admin/users/${id}`, {
      headers: authHeaders(),
    })

    if (!res.ok) {
      const { error } = await res.json()
      return { error: error || 'Failed to fetch user' }
    }

    const { data } = await res.json()
    return { data }
  }

  async function changePlan(id, plan) {
    loading.value = true
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ plan }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        return { error: error || 'Failed to change plan' }
      }

      const result = await res.json()
      // Update user in local list
      const idx = users.value.findIndex((u) => u.id === id)
      if (idx !== -1) {
        users.value[idx] = { ...users.value[idx], ...result.data }
      }
      return result
    } finally {
      loading.value = false
    }
  }

  async function changeStatus(id, status) {
    loading.value = true
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        return { error: error || 'Failed to change status' }
      }

      const { data } = await res.json()
      // Update user in local list
      const idx = users.value.findIndex((u) => u.id === id)
      if (idx !== -1) {
        users.value[idx] = { ...users.value[idx], ...data }
      }
      return { data }
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    loading.value = true
    try {
      const res = await fetch('/api/admin/stats', {
        headers: authHeaders(),
      })

      if (!res.ok) {
        const { error } = await res.json()
        return { error: error || 'Failed to fetch stats' }
      }

      const { data } = await res.json()
      stats.value = data
      return { data }
    } finally {
      loading.value = false
    }
  }

  async function fetchAuditLog(params = {}) {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (params.page) query.set('page', params.page)
      if (params.limit) query.set('limit', params.limit)
      if (params.target_user_id)
        query.set('target_user_id', params.target_user_id)
      if (params.action) query.set('action', params.action)

      const res = await fetch(`/api/admin/audit-log?${query}`, {
        headers: authHeaders(),
      })

      if (!res.ok) {
        const { error } = await res.json()
        return { error: error || 'Failed to fetch audit log' }
      }

      const { data, pagination } = await res.json()
      auditLog.value = data
      auditPagination.value = pagination
      return { data }
    } finally {
      loading.value = false
    }
  }

  return {
    users,
    usersPagination,
    stats,
    auditLog,
    auditPagination,
    loading,
    fetchUsers,
    fetchUserDetail,
    changePlan,
    changeStatus,
    fetchStats,
    fetchAuditLog,
  }
})
