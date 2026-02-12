<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useRelay } from '../../composables/use-relay.js'
import { useEndpoints } from '../../composables/use-endpoints.js'

const relay = useRelay()
const endpoints = useEndpoints()

onMounted(() => {
  relay.startRelay()
})

onUnmounted(() => {
  relay.stopRelay()
})

watch(
  () => endpoints.endpoints,
  () => {
    relay.updateSubscription()
  },
  { deep: true },
)
</script>

<template>
  <div style="display: none" />
</template>
