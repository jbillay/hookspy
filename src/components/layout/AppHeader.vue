<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import RelayStatus from '../relay/RelayStatus.vue'
import { useAuth } from '../../composables/use-auth.js'

const router = useRouter()
const route = useRoute()
const auth = useAuth()
const mobileMenuOpen = ref(false)

async function handleLogout() {
  await auth.signOut()
  router.push({ name: 'login' })
}

function isActive(path) {
  return route.path.startsWith(path)
}

function userInitial() {
  const email = auth.user?.email || ''
  return email.charAt(0).toUpperCase()
}
</script>

<template>
  <header class="sticky top-0 z-50 bg-white border-b border-neutral-200">
    <div class="max-w-7xl mx-auto px-6">
      <div class="flex items-center justify-between h-14">
        <!-- Left: Logo + Nav -->
        <div class="flex items-center gap-8">
          <router-link
            to="/dashboard"
            class="flex items-center gap-2 no-underline"
          >
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style="background-color: var(--hs-brand)"
            >
              H
            </div>
            <span class="text-lg font-bold text-neutral-900 font-display"
              >HookSpy</span
            >
          </router-link>

          <!-- Desktop nav -->
          <nav class="hidden md:flex items-center gap-1">
            <router-link
              to="/dashboard"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors duration-150',
                isActive('/dashboard')
                  ? 'bg-brand-subtle text-brand'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
              ]"
            >
              Dashboard
            </router-link>
            <router-link
              to="/endpoints"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors duration-150',
                isActive('/endpoints')
                  ? 'bg-brand-subtle text-brand'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
              ]"
            >
              Endpoints
            </router-link>
            <router-link
              to="/logs"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors duration-150',
                isActive('/logs')
                  ? 'bg-brand-subtle text-brand'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
              ]"
            >
              Logs
            </router-link>
          </nav>
        </div>

        <!-- Right: Relay + User -->
        <div class="hidden md:flex items-center gap-4">
          <RelayStatus />
          <div class="w-px h-5 bg-neutral-200" />
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-brand bg-brand-subtle"
            >
              {{ userInitial() }}
            </div>
            <span class="text-sm text-neutral-600 max-w-[160px] truncate">{{
              auth.user?.email
            }}</span>
          </div>
          <button
            class="text-sm text-neutral-500 hover:text-neutral-700 transition-colors cursor-pointer bg-transparent border-0 px-2 py-1"
            @click="handleLogout"
          >
            <i class="pi pi-sign-out text-sm" />
          </button>
        </div>

        <!-- Mobile hamburger -->
        <button
          class="md:hidden p-2 text-neutral-600 hover:text-neutral-900 bg-transparent border-0 cursor-pointer"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <i :class="mobileMenuOpen ? 'pi pi-times' : 'pi pi-bars'" />
        </button>
      </div>

      <!-- Mobile menu -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden pb-4 border-t border-neutral-100 pt-3 flex flex-col gap-1"
      >
        <router-link
          to="/dashboard"
          class="px-3 py-2 rounded-lg text-sm font-medium no-underline text-neutral-700 hover:bg-neutral-100"
          @click="mobileMenuOpen = false"
        >
          Dashboard
        </router-link>
        <router-link
          to="/endpoints"
          class="px-3 py-2 rounded-lg text-sm font-medium no-underline text-neutral-700 hover:bg-neutral-100"
          @click="mobileMenuOpen = false"
        >
          Endpoints
        </router-link>
        <router-link
          to="/logs"
          class="px-3 py-2 rounded-lg text-sm font-medium no-underline text-neutral-700 hover:bg-neutral-100"
          @click="mobileMenuOpen = false"
        >
          Logs
        </router-link>
        <div class="mt-2 px-3 flex items-center justify-between">
          <RelayStatus />
          <button
            class="text-sm text-neutral-500 hover:text-neutral-700 bg-transparent border-0 cursor-pointer"
            @click="handleLogout"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
