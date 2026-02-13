<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  endpoint: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggle'])
const router = useRouter()
const toast = useToast()

const webhookUrl = computed(
  () => `${window.location.origin}/hook/${props.endpoint.slug}`,
)

const targetSummary = computed(
  () =>
    `${props.endpoint.target_url}:${props.endpoint.target_port}${props.endpoint.target_path}`,
)

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    toast.add({
      severity: 'success',
      summary: 'URL copied',
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Failed to copy',
      life: 3000,
    })
  }
}

function goToEndpoint() {
  router.push(`/endpoints/${props.endpoint.id}`)
}

function goToLogs() {
  router.push(`/endpoints/${props.endpoint.id}`)
}
</script>

<template>
  <Card class="mb-3">
    <template #content>
      <div class="flex items-center justify-between mb-2">
        <a
          href="#"
          class="text-sm font-semibold text-surface-700 hover:text-primary no-underline"
          @click.prevent="goToEndpoint"
        >
          {{ endpoint.name }}
        </a>
        <div class="flex items-center gap-2">
          <Tag
            :value="endpoint.is_active ? 'Active' : 'Inactive'"
            :severity="endpoint.is_active ? 'success' : 'danger'"
            class="text-xs"
          />
          <ToggleSwitch
            :model-value="endpoint.is_active"
            @update:model-value="emit('toggle')"
          />
        </div>
      </div>

      <div class="flex items-center gap-1 mb-2">
        <code class="text-xs text-surface-500 truncate flex-1">{{
          webhookUrl
        }}</code>
        <Button
          icon="pi pi-copy"
          severity="secondary"
          text
          size="small"
          @click="copyUrl"
        />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-xs text-surface-400">{{ targetSummary }}</span>
        <Button
          label="View Logs"
          icon="pi pi-list"
          severity="secondary"
          text
          size="small"
          @click="goToLogs"
        />
      </div>
    </template>
  </Card>
</template>
