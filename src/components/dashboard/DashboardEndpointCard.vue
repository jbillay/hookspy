<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
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
  () => `${window.location.origin}/api/hook/${props.endpoint.slug}`,
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
</script>

<template>
  <div
    class="card-surface p-4 transition-all duration-200 hover:shadow-sm cursor-pointer"
    @click="goToEndpoint"
  >
    <!-- Top row: name + toggle -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2 min-w-0">
        <span
          :class="[
            'status-dot flex-shrink-0',
            endpoint.is_active ? 'status-dot-active' : 'status-dot-inactive',
          ]"
        />
        <span class="text-sm font-semibold text-neutral-900 truncate">
          {{ endpoint.name }}
        </span>
      </div>
      <ToggleSwitch
        :model-value="endpoint.is_active"
        @click.stop
        @update:model-value="emit('toggle')"
      />
    </div>

    <!-- Webhook URL -->
    <div
      class="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2 mb-3"
      @click.stop
    >
      <code class="text-xs text-neutral-600 font-code truncate flex-1">{{
        webhookUrl
      }}</code>
      <button
        class="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-600 transition-colors bg-transparent border-0 cursor-pointer"
        title="Copy URL"
        @click.stop="copyUrl"
      >
        <i class="pi pi-copy text-sm" />
      </button>
    </div>

    <!-- Bottom: target + arrow -->
    <div class="flex items-center justify-between">
      <span class="text-xs text-neutral-400 font-code truncate">{{
        targetSummary
      }}</span>
      <i class="pi pi-arrow-right text-xs text-neutral-300" />
    </div>
  </div>
</template>
