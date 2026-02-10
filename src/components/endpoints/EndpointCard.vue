<script setup>
import { computed } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
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
  <Card class="w-full">
    <template #title>
      <div class="flex items-center justify-between">
        <span>{{ endpoint.name }}</span>
        <Tag
          :value="endpoint.is_active ? 'Active' : 'Inactive'"
          :severity="endpoint.is_active ? 'success' : 'warn'"
        />
      </div>
    </template>
    <template #content>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <code
            class="text-sm bg-surface-100 px-2 py-1 rounded flex-1 truncate"
          >
            {{ webhookUrl }}
          </code>
          <Button
            icon="pi pi-copy"
            severity="secondary"
            text
            size="small"
            aria-label="Copy webhook URL"
            @click="copyUrl"
          />
        </div>
        <div class="text-sm text-surface-600">
          <span>Target: {{ targetSummary }}</span>
          <span class="ml-4">Timeout: {{ endpoint.timeout_seconds }}s</span>
        </div>
        <div class="text-xs text-surface-500">
          Last updated: {{ lastActivity }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-between">
        <div class="flex gap-2">
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
        <slot name="toggle" />
      </div>
    </template>
  </Card>
</template>
