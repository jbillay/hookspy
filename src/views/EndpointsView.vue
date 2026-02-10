<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import EndpointCard from '../components/endpoints/EndpointCard.vue'
import { useEndpoints } from '../composables/use-endpoints.js'
import ToggleSwitch from 'primevue/toggleswitch'

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const store = useEndpoints()

onMounted(() => {
  store.fetchEndpoints()
})

function handleEdit(endpoint) {
  router.push({ name: 'endpoint-detail', params: { id: endpoint.id } })
}

function handleDelete(endpoint) {
  confirm.require({
    message: `Are you sure you want to delete "${endpoint.name}"? This will also delete all associated webhook logs.`,
    header: 'Delete Endpoint',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const { error } = await store.deleteEndpoint(endpoint.id)
      if (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: error,
          life: 5000,
        })
      } else {
        toast.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `"${endpoint.name}" has been deleted`,
          life: 3000,
        })
      }
    },
  })
}

async function handleToggle(endpoint) {
  const { error } = await store.toggleActive(endpoint.id)
  if (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error,
      life: 5000,
    })
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Endpoints</h1>
      <Button
        label="New Endpoint"
        icon="pi pi-plus"
        @click="router.push({ name: 'endpoint-new' })"
      />
    </div>

    <div
      v-if="store.loading && store.endpoints.length === 0"
      class="flex justify-center py-12"
    >
      <ProgressSpinner />
    </div>

    <div
      v-else-if="store.endpoints.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <i class="pi pi-inbox text-5xl text-surface-400 mb-4" />
      <h2 class="text-xl font-semibold mb-2">No endpoints yet</h2>
      <p class="text-surface-500 mb-6">
        Create your first endpoint to start receiving webhooks.
      </p>
      <Button
        label="Create your first endpoint"
        icon="pi pi-plus"
        @click="router.push({ name: 'endpoint-new' })"
      />
    </div>

    <div v-else class="flex flex-col gap-4">
      <EndpointCard
        v-for="endpoint in store.endpoints"
        :key="endpoint.id"
        :endpoint="endpoint"
        @edit="handleEdit"
        @delete="handleDelete"
      >
        <template #toggle>
          <ToggleSwitch
            :model-value="endpoint.is_active"
            @update:model-value="handleToggle(endpoint)"
          />
        </template>
      </EndpointCard>
    </div>
  </div>
</template>
