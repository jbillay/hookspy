<script setup>
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import AppLayout from './components/layout/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <Toast />
    <ConfirmDialog />
    <RouterView />
  </AppLayout>
</template>
