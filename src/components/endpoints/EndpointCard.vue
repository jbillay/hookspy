<script setup>
import { computed } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  endpoint: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['edit', 'delete', 'toggle'])

const toast = useToast()

const webhookUrl = computed(() => {
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base}/api/hook/${props.endpoint.slug}`
})

const targetSummary = computed(() => {
  const ep = props.endpoint
  return `${ep.target_url}:${ep.target_port}${ep.target_path}`
})

const lastActivity = computed(() => {
  const date = props.endpoint.updated_at
  if (!date) return 'Never'
  return new Date(date).toLocaleString()
})

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    toast.add({
      severity: 'success',
      summary: 'Copied',
      detail: 'Webhook URL copied to clipboard',
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to copy URL',
      life: 3000,
    })
  }
}
</script>

<template>
  <div class="card-surface p-5 flex flex-col gap-3">
    <!-- Header: name + status -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        <span
          :class="[
            'status-dot flex-shrink-0',
            endpoint.is_active ? 'status-dot-active' : 'status-dot-inactive',
          ]"
        />
        <span class="text-sm font-semibold text-neutral-900 truncate">{{
          endpoint.name
        }}</span>
      </div>
      <slot name="toggle" />
    </div>

    <!-- Webhook URL -->
    <div class="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
      <code class="text-xs text-neutral-600 font-code truncate flex-1">{{
        webhookUrl
      }}</code>
      <button
        class="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-600 transition-colors bg-transparent border-0 cursor-pointer"
        title="Copy URL"
        @click="copyUrl"
      >
        <i class="pi pi-copy text-sm" />
      </button>
    </div>

    <!-- Details -->
    <div class="flex items-center justify-between text-xs">
      <span class="text-neutral-500">
        Target: <span class="font-code">{{ targetSummary }}</span>
      </span>
      <span class="text-neutral-400">
        Timeout: {{ endpoint.timeout_seconds }}s
      </span>
    </div>

    <div class="text-xs text-neutral-400">Updated: {{ lastActivity }}</div>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-1 border-t border-neutral-100">
      <Button
        label="Edit"
        icon="pi pi-pencil"
        severity="secondary"
        text
        size="small"
        @click="emit('edit', endpoint)"
      />
      <Button
        label="Delete"
        icon="pi pi-trash"
        severity="danger"
        text
        size="small"
        @click="emit('delete', endpoint)"
      />
    </div>
  </div>
</template>
