<script setup>
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuth } from '../../composables/use-auth.js'

const router = useRouter()
const auth = useAuth()

async function handleLogout() {
  await auth.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="flex items-center justify-between px-6 py-3 border-b border-surface-200"
  >
    <router-link
      to="/dashboard"
      class="text-xl font-bold text-primary no-underline"
    >
      HookSpy
    </router-link>
    <div class="flex items-center gap-3">
      <span class="text-sm text-surface-600">{{ auth.user?.email }}</span>
      <Button
        label="Logout"
        icon="pi pi-sign-out"
        severity="secondary"
        text
        size="small"
        @click="handleLogout"
      />
    </div>
  </header>
</template>
