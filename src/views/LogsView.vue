<script setup>
import LogList from '../components/logs/LogList.vue'
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">Webhook Logs</h1>
      <p class="page-subtitle">
        View and inspect all incoming webhook requests
      </p>
    </div>
    <LogList />
  </div>
</template>
