<script setup>
import { computed } from 'vue'
import { useRelay } from '../../composables/use-relay.js'

const relay = useRelay()

const dotClass = computed(() => {
  switch (relay.relayStatus) {
    case 'active':
      return 'bg-green-500'
    case 'no-endpoints':
      return 'bg-amber-500'
    default:
      return 'bg-red-500'
  }
})

const label = computed(() => {
  switch (relay.relayStatus) {
    case 'active':
      return 'Relay Active'
    case 'no-endpoints':
      return 'No Active Endpoints'
    default:
      return 'Relay Inactive'
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <span :class="['w-2 h-2 rounded-full', dotClass]" />
    <span class="text-sm text-surface-600">{{ label }}</span>
  </div>
</template>
