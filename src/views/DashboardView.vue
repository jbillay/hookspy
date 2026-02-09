<script setup>
import Card from 'primevue/card'
import { useAuth } from '../composables/use-auth.js'

const auth = useAuth()
</script>

<template>
  <div class="flex items-center justify-center min-h-[calc(100vh-4rem)]">
    <Card class="w-full max-w-lg">
      <template #title>Welcome to HookSpy</template>
      <template #content>
        <p>
          Signed in as
          <strong>{{ auth.user?.email }}</strong>
        </p>
      </template>
    </Card>
  </div>
</template>
