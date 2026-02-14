<script setup>
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/use-auth.js'

const router = useRouter()
const auth = useAuth()

function handleGetStarted() {
  router.push(
    auth.isAuthenticated ? { name: 'dashboard' } : { name: 'register' },
  )
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center px-4"
    style="
      background: linear-gradient(
        135deg,
        #f0fdfa 0%,
        #fafafa 50%,
        #eff6ff 100%
      );
    "
  >
    <div class="text-center max-w-lg">
      <!-- Logo -->
      <div class="inline-flex items-center gap-3 mb-6">
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-sm"
          style="background-color: var(--hs-brand)"
        >
          H
        </div>
        <span class="text-3xl font-bold text-neutral-900 font-display"
          >HookSpy</span
        >
      </div>

      <p class="text-neutral-500 text-lg mb-2 leading-relaxed">
        Webhook Relay Service
      </p>
      <p class="text-neutral-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">
        Intercept, inspect, and relay webhooks to your local development server
        — right from your browser.
      </p>

      <button class="btn-brand text-base px-6 py-3" @click="handleGetStarted">
        Get Started
        <i class="pi pi-arrow-right text-sm" />
      </button>

      <p class="text-xs text-neutral-400 mt-6">
        Already have an account?
        <router-link
          to="/login"
          class="font-medium no-underline"
          style="color: var(--hs-brand)"
          >Sign in</router-link
        >
      </p>
    </div>
  </div>
</template>
