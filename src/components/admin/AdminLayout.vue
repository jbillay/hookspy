<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { label: 'Dashboard', icon: 'pi pi-chart-bar', to: '/admin/dashboard' },
  { label: 'Users', icon: 'pi pi-users', to: '/admin/users' },
]

function isActive(path) {
  return route.path === path
}
</script>

<template>
  <div class="flex gap-6 max-w-7xl mx-auto py-6 px-4">
    <!-- Sidebar -->
    <aside class="w-56 flex-shrink-0">
      <div class="card-surface p-4">
        <div
          class="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100"
        >
          <i class="pi pi-shield text-brand" />
          <span class="font-semibold text-neutral-900">Admin</span>
        </div>
        <nav class="flex flex-col gap-1">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors',
              isActive(item.to)
                ? 'bg-brand-subtle text-brand'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
            ]"
          >
            <i :class="[item.icon, 'text-sm']" />
            {{ item.label }}
          </router-link>
        </nav>
        <div class="mt-4 pt-3 border-t border-neutral-100">
          <router-link
            to="/dashboard"
            class="flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 no-underline transition-colors"
          >
            <i class="pi pi-arrow-left text-xs" />
            Back to app
          </router-link>
        </div>
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 min-w-0">
      <slot />
    </main>
  </div>
</template>
