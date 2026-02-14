<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
  <div class="page-container">
    <!-- Page header -->
    <div class="page-header flex items-center justify-between">
      <div>
        <h1 class="page-title">Endpoints</h1>
        <p class="page-subtitle">
          Manage your webhook endpoints and forwarding targets
        </p>
      </div>
      <button class="btn-brand" @click="router.push({ name: 'endpoint-new' })">
        <i class="pi pi-plus text-sm" />
        New Endpoint
      </button>
    </div>

    <!-- Loading -->
    <div
      v-if="store.loading && store.endpoints.length === 0"
      class="flex justify-center py-16"
    >
      <ProgressSpinner />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="store.endpoints.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div
        class="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-neutral-100"
      >
        <i class="pi pi-inbox text-3xl text-neutral-400" />
      </div>
      <h2 class="text-lg font-semibold text-neutral-800 mb-2">
        No endpoints yet
      </h2>
      <p class="text-sm text-neutral-500 mb-6 max-w-sm">
        Create your first endpoint to start receiving and relaying webhooks.
      </p>
      <button class="btn-brand" @click="router.push({ name: 'endpoint-new' })">
        <i class="pi pi-plus text-sm" />
        Create your first endpoint
      </button>
    </div>

    <!-- Endpoint grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
