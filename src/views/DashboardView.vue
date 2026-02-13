<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import StatCard from '../components/dashboard/StatCard.vue'
import DashboardEndpointCard from '../components/dashboard/DashboardEndpointCard.vue'
import ActivityFeed from '../components/dashboard/ActivityFeed.vue'
import { useDashboard } from '../composables/use-dashboard.js'
import { useEndpoints } from '../composables/use-endpoints.js'
import { useAuth } from '../composables/use-auth.js'

const dashboard = useDashboard()
const endpoints = useEndpoints()
const auth = useAuth()
const router = useRouter()

onMounted(async () => {
  await auth.initAuth()
  if (endpoints.endpoints.length === 0) {
    await endpoints.fetchEndpoints()
  }
  await dashboard.fetchStats()
  dashboard.startSubscription()
})

onUnmounted(() => {
  dashboard.stopSubscription()
})

function handleToggle(endpoint) {
  endpoints.toggleActive(endpoint.id)
}
</script>

<template>
  <div class="p-6">
    <!-- Loading state -->
    <div
      v-if="dashboard.loadingStats && !dashboard.hasEndpoints"
      class="flex justify-center py-16"
    >
      <ProgressSpinner />
    </div>

    <!-- Onboarding state for new users -->
    <div
      v-else-if="!dashboard.hasEndpoints && !dashboard.loadingStats"
      class="flex items-center justify-center min-h-[calc(100vh-8rem)]"
    >
      <Card class="w-full max-w-md text-center">
        <template #content>
          <i class="pi pi-link text-5xl text-surface-300 mb-4 block"></i>
          <h2 class="text-xl font-semibold text-surface-700 mb-2">
            Welcome to HookSpy
          </h2>
          <p class="text-surface-500 mb-4">
            Create your first endpoint to start receiving and relaying webhooks.
          </p>
          <Button
            label="Create Your First Endpoint"
            icon="pi pi-plus"
            @click="router.push('/endpoints/new')"
          />
        </template>
      </Card>
    </div>

    <!-- Full dashboard -->
    <template v-else>
      <!-- Summary stats row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Endpoints"
          :value="dashboard.totalEndpoints"
          icon="pi pi-link"
        />
        <StatCard
          label="Active"
          :value="dashboard.activeEndpoints"
          icon="pi pi-check-circle"
          severity="success"
        />
        <StatCard
          label="Inactive"
          :value="dashboard.inactiveEndpoints"
          icon="pi pi-pause-circle"
          severity="warn"
        />
        <StatCard
          label="Requests (24h)"
          :value="dashboard.requestCount24h"
          icon="pi pi-inbox"
        />
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left column: Endpoints -->
        <div>
          <h3 class="text-lg font-semibold text-surface-700 mb-3">
            Your Endpoints
          </h3>
          <DashboardEndpointCard
            v-for="endpoint in endpoints.endpoints"
            :key="endpoint.id"
            :endpoint="endpoint"
            @toggle="handleToggle(endpoint)"
          />
        </div>

        <!-- Right column: Activity Feed -->
        <div>
          <h3 class="text-lg font-semibold text-surface-700 mb-3">
            Recent Activity
          </h3>
          <ActivityFeed
            :logs="dashboard.recentLogs"
            :loading="dashboard.loadingStats"
          />
        </div>
      </div>
    </template>
  </div>
</template>
