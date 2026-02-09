<script setup>
import Toast from 'primevue/toast'
import AppLayout from './components/layout/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <Toast />
    <RouterView />
  </AppLayout>
</template>
