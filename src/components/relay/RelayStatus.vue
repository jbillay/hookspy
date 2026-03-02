<script setup>
import { computed } from 'vue'
import Skeleton from 'primevue/skeleton'
import { useRelay } from '../../composables/use-relay.js'
import { useEndpoints } from '../../composables/use-endpoints.js'
import { useRealtimeTransport } from '../../composables/use-realtime-transport.js'

const relay = useRelay()
const endpoints = useEndpoints()
const transport = useRealtimeTransport()

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
      if (
        transport.transportMode.value === null ||
        transport.transportMode.value === 'unknown'
      ) {
        return {
          dotClass: 'status-dot bg-blue-400 status-dot-pulse',
          label: 'Connecting...',
          pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
        }
      }
      return {
        dotClass: 'status-dot bg-neutral-400',
        label: 'Disconnected',
        pillClass: 'bg-neutral-50 text-neutral-600 border-neutral-200',
      }
  }
})

const transportIndicator = computed(() => {
  switch (transport.transportMode.value) {
    case 'ws':
      return {
        dotClass: 'status-dot bg-green-500',
        label: 'Live',
        pillClass: 'bg-green-50 text-green-700 border-green-200',
        tooltip: null,
      }
    case 'poll':
      return {
        dotClass: 'status-dot bg-amber-500',
        label: 'Polling (2s)',
        pillClass: 'bg-amber-50 text-amber-700 border-amber-200',
        tooltip:
          'WebSocket unavailable. Using HTTP polling as fallback. Updates may be slightly delayed.',
      }
    default:
      return {
        dotClass: 'status-dot bg-gray-400',
        label: 'Connecting...',
        pillClass: 'bg-gray-50 text-gray-600 border-gray-200',
        tooltip: null,
      }
  }
})
</script>

<template>
  <Skeleton
    v-if="!endpoints.initialLoaded"
    width="6rem"
    height="1.5rem"
    border-radius="9999px"
  />
  <div v-else class="inline-flex items-center gap-2">
    <div
      :class="[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        statusConfig.pillClass,
      ]"
    >
      <span :class="statusConfig.dotClass" />
      <span>{{ statusConfig.label }}</span>
    </div>
    <div
      v-if="relay.relayStatus === 'active'"
      v-tooltip.bottom="transportIndicator.tooltip"
      :class="[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
        transportIndicator.pillClass,
      ]"
    >
      <span
        :class="transportIndicator.dotClass"
        style="width: 6px; height: 6px"
      />
      <span>{{ transportIndicator.label }}</span>
    </div>
  </div>
</template>
