<script setup>
import Card from 'primevue/card'

defineProps({
  stats: {
    type: Object,
    default: null,
  },
})
</script>

<template>
  <div
    v-if="stats"
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  >
    <Card class="text-center">
      <template #content>
        <div class="text-3xl font-bold text-neutral-900">
          {{ stats.total_users }}
        </div>
        <div class="text-sm text-neutral-500 mt-1">Total Users</div>
        <div class="text-xs text-neutral-400 mt-2">
          {{ stats.users_by_plan?.free || 0 }} Free /
          {{ stats.users_by_plan?.pro || 0 }} Pro
        </div>
      </template>
    </Card>

    <Card class="text-center">
      <template #content>
        <div class="text-3xl font-bold text-green-600">
          {{ stats.users_by_status?.active || 0 }}
        </div>
        <div class="text-sm text-neutral-500 mt-1">Active Users</div>
        <div class="text-xs text-neutral-400 mt-2">
          {{ stats.users_by_status?.disabled || 0 }} disabled
        </div>
      </template>
    </Card>

    <Card class="text-center">
      <template #content>
        <div class="text-3xl font-bold text-neutral-900">
          {{ stats.total_endpoints }}
        </div>
        <div class="text-sm text-neutral-500 mt-1">Total Endpoints</div>
      </template>
    </Card>

    <Card class="text-center">
      <template #content>
        <div class="text-3xl font-bold text-brand">
          {{ stats.requests_24h }}
        </div>
        <div class="text-sm text-neutral-500 mt-1">Requests (24h)</div>
      </template>
    </Card>
  </div>
</template>
