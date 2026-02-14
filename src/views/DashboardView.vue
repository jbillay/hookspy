<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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
  <div class="page-container">
    <!-- Loading state -->
    <div
      v-if="dashboard.loadingStats && !dashboard.hasEndpoints"
      class="flex justify-center py-20"
    >
      <ProgressSpinner />
    </div>

    <!-- Onboarding state -->
    <div
      v-else-if="!dashboard.hasEndpoints && !dashboard.loadingStats"
      class="flex items-center justify-center min-h-[calc(100vh-10rem)]"
    >
      <div class="text-center max-w-md">
        <div
          class="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-brand-subtle"
        >
          <i class="pi pi-link text-3xl" style="color: var(--hs-brand)" />
        </div>
        <h2 class="text-xl font-bold text-neutral-900 mb-2 font-display">
          Welcome to HookSpy
        </h2>
        <p class="text-neutral-500 mb-6 text-sm leading-relaxed">
          Create your first endpoint to start receiving and relaying webhooks to
          your local development server.
        </p>
        <button class="btn-brand" @click="router.push('/endpoints/new')">
          <i class="pi pi-plus text-sm" />
          Create Your First Endpoint
        </button>
      </div>
    </div>

    <!-- Full dashboard -->
    <template v-else>
      <!-- Page header -->
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">
          Overview of your webhook endpoints and activity
        </p>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Endpoints"
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
          severity="info"
        />
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Left column: Endpoints (3/5) -->
        <div class="lg:col-span-3">
          <div class="section-header">
            <h3 class="section-title">Your Endpoints</h3>
            <router-link
              to="/endpoints"
              class="text-sm font-medium no-underline"
              style="color: var(--hs-brand)"
            >
              View all
            </router-link>
          </div>
          <div class="flex flex-col gap-3">
            <DashboardEndpointCard
              v-for="endpoint in endpoints.endpoints"
              :key="endpoint.id"
              :endpoint="endpoint"
              @toggle="handleToggle(endpoint)"
            />
          </div>
        </div>

        <!-- Right column: Activity Feed (2/5) -->
        <div class="lg:col-span-2">
          <div class="section-header">
            <h3 class="section-title">Recent Activity</h3>
            <router-link
              to="/logs"
              class="text-sm font-medium no-underline"
              style="color: var(--hs-brand)"
            >
              View all
            </router-link>
          </div>
          <ActivityFeed
            :logs="dashboard.recentLogs"
            :loading="dashboard.loadingStats"
          />
        </div>
      </div>
    </template>
  </div>
</template>
