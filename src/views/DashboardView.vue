<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Skeleton from 'primevue/skeleton'
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
    <!-- Loading skeleton -->
    <div v-if="dashboard.loadingStats && !dashboard.hasEndpoints">
      <!-- Page header skeleton -->
      <div class="page-header">
        <Skeleton width="10rem" height="1.75rem" class="mb-2" />
        <Skeleton width="20rem" height="1rem" />
      </div>

      <!-- Stats row skeleton -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div v-for="n in 4" :key="n" class="card-surface p-5">
          <div class="flex items-start gap-3">
            <Skeleton shape="circle" size="2.5rem" />
            <div>
              <Skeleton width="3rem" height="1.75rem" class="mb-1" />
              <Skeleton width="5rem" height="0.75rem" />
            </div>
          </div>
        </div>
      </div>

      <!-- Two-column layout skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Left: Endpoint cards skeleton -->
        <div class="lg:col-span-3">
          <div class="section-header">
            <Skeleton width="8rem" height="1.25rem" />
            <Skeleton width="4rem" height="0.875rem" />
          </div>
          <div class="flex flex-col gap-3">
            <div v-for="n in 3" :key="n" class="card-surface p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <Skeleton shape="circle" size="0.5rem" />
                  <Skeleton width="8rem" height="0.875rem" />
                </div>
                <Skeleton
                  width="2.5rem"
                  height="1.25rem"
                  border-radius="1rem"
                />
              </div>
              <Skeleton
                width="100%"
                height="2rem"
                border-radius="0.5rem"
                class="mb-3"
              />
              <Skeleton width="60%" height="0.75rem" />
            </div>
          </div>
        </div>

        <!-- Right: Activity feed skeleton -->
        <div class="lg:col-span-2">
          <div class="section-header">
            <Skeleton width="8rem" height="1.25rem" />
            <Skeleton width="4rem" height="0.875rem" />
          </div>
          <div class="card-surface">
            <div
              v-for="n in 5"
              :key="n"
              :class="[
                'flex items-center gap-3 px-4 py-3',
                n < 5 ? 'border-b border-neutral-100' : '',
              ]"
            >
              <Skeleton width="3rem" height="1.25rem" border-radius="0.25rem" />
              <div class="flex-1">
                <Skeleton width="70%" height="0.875rem" class="mb-1" />
                <Skeleton width="40%" height="0.625rem" />
              </div>
              <Skeleton width="2.5rem" height="0.75rem" />
            </div>
          </div>
        </div>
      </div>
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
