<script setup>
import Card from 'primevue/card'
import Button from 'primevue/button'
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
        <Button label="Get Started" icon="pi pi-arrow-right" />
      </template>
    </Card>
  </div>
</template>
