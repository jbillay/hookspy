<script setup>
import ProgressBar from 'primevue/progressbar'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  current: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 0,
  },
})

function percentage() {
  if (props.max === 0) return 0
  return Math.round((props.current / props.max) * 100)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between text-sm">
      <span class="text-neutral-600">{{ label }}</span>
      <span class="font-medium text-neutral-900">{{ current }}/{{ max }}</span>
    </div>
    <ProgressBar
      :value="percentage()"
      :show-value="false"
      style="height: 6px"
      :class="{ 'plan-usage-full': percentage() >= 100 }"
    />
  </div>
</template>

<style>
.plan-usage-full .p-progressbar-value {
  background-color: var(--p-red-500, #ef4444) !important;
}
</style>
