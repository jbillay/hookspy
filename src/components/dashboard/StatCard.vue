<script setup>
import Card from 'primevue/card'

defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [Number, String],
    required: true,
  },
  icon: {
    type: String,
    default: null,
  },
  severity: {
    type: String,
    default: null,
  },
})

const severityClasses = {
  info: 'text-blue-600',
  success: 'text-green-600',
  warn: 'text-orange-500',
  danger: 'text-red-600',
}
</script>

<template>
  <Card class="stat-card">
    <template #content>
      <div class="flex items-center gap-3">
        <i
          v-if="icon"
          :class="[icon, severityClasses[severity] || 'text-surface-500']"
          class="text-2xl"
        ></i>
        <div>
          <div
            class="text-2xl font-bold"
            :class="severityClasses[severity] || 'text-surface-700'"
          >
            {{ value }}
          </div>
          <div class="text-sm text-surface-500">{{ label }}</div>
        </div>
      </div>
    </template>
  </Card>
</template>
