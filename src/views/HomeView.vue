<script setup>
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
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
  <div class="flex items-center justify-center min-h-screen">
    <Card class="w-full max-w-lg">
      <template #title>HookSpy</template>
      <template #subtitle>Webhook Relay Service</template>
      <template #content>
        <p class="mb-4">
          Intercept, inspect, and relay webhooks to your local development
          server — right from your browser.
        </p>
      </template>
      <template #footer>
        <Button
          label="Get Started"
          icon="pi pi-arrow-right"
          @click="handleGetStarted"
        />
      </template>
    </Card>
  </div>
</template>
