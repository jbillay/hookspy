<script setup>
import { computed } from 'vue'
import { useRelay } from '../../composables/use-relay.js'

const relay = useRelay()

const statusConfig = computed(() => {
  switch (relay.relayStatus) {
    case 'active':
      return {
        dotClass: 'status-dot-active status-dot-pulse',
        label: 'Connected',
        pillClass: 'bg-green-50 text-green-700 border-green-200',
      }
    case 'no-endpoints':
      return {
        dotClass: 'status-dot bg-amber-500',
        label: 'No Endpoints',
        pillClass: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    default:
      return {
        dotClass: 'status-dot bg-neutral-400',
        label: 'Disconnected',
        pillClass: 'bg-neutral-50 text-neutral-600 border-neutral-200',
      }
  }
})
</script>

<template>
  <div
    :class="[
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      statusConfig.pillClass,
    ]"
  >
    <span :class="statusConfig.dotClass" />
    <span>{{ statusConfig.label }}</span>
  </div>
</template>
