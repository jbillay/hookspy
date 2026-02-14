<script setup>
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

const iconStyles = {
  success: {
    bg: 'bg-green-50',
    text: 'text-green-600',
  },
  warn: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  danger: {
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
}

const defaultStyle = {
  bg: 'bg-brand-subtle',
  text: 'text-brand',
}
</script>

<template>
  <div class="card-surface p-5 transition-all duration-200 hover:shadow-sm">
    <div class="flex items-start gap-3">
      <div
        v-if="icon"
        :class="[
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          (iconStyles[severity] || defaultStyle).bg,
        ]"
      >
        <i
          :class="[icon, (iconStyles[severity] || defaultStyle).text]"
          class="text-lg"
        />
      </div>
      <div class="min-w-0">
        <div class="text-2xl font-bold text-neutral-900 font-display">
          {{ value }}
        </div>
        <div class="text-xs font-medium text-neutral-500 mt-0.5">
          {{ label }}
        </div>
      </div>
    </div>
  </div>
</template>
