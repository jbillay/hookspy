<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import EndpointCard from '../components/endpoints/EndpointCard.vue'
import EndpointEditDialog from '../components/endpoints/EndpointEditDialog.vue'
import PlanUsage from '../components/settings/PlanUsage.vue'
import { useEndpoints } from '../composables/use-endpoints.js'
import { useUserPlan } from '../composables/use-user-plan.js'
import ToggleSwitch from 'primevue/toggleswitch'

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const store = useEndpoints()
const { endpointsMax, isFree } = useUserPlan()

const editDialogVisible = ref(false)
const atLimit = ref(false)

function checkLimit() {
  atLimit.value = store.endpoints.length >= endpointsMax.value
}
const editingEndpoint = ref(null)

onMounted(async () => {
  await store.fetchEndpoints()
  checkLimit()
})

function handleEdit(endpoint) {
  editingEndpoint.value = endpoint
  editDialogVisible.value = true
}

async function handleEditSubmit(form) {
  const { error } = await store.updateEndpoint(editingEndpoint.value.id, form)
  if (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error,
      life: 5000,
    })
    return
  }
  toast.add({
    severity: 'success',
    summary: 'Updated',
    detail: 'Endpoint updated successfully',
    life: 3000,
  })
  editDialogVisible.value = false
  editingEndpoint.value = null
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

function handleDuplicate(endpoint) {
  router.push({
    name: 'endpoint-new',
    query: {
      duplicate: endpoint.id,
      name: `${endpoint.name} (copy)`,
      target_url: endpoint.target_url,
      target_port: endpoint.target_port,
      target_path: endpoint.target_path,
      timeout_seconds: endpoint.timeout_seconds,
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
      <button
        v-if="!atLimit"
        class="btn-brand"
        @click="router.push({ name: 'endpoint-new' })"
      >
        <i class="pi pi-plus text-sm" />
        New Endpoint
      </button>
      <div v-else class="flex flex-col items-end gap-1">
        <span class="text-sm text-neutral-500">Endpoint limit reached</span>
        <router-link
          v-if="isFree"
          to="/settings"
          class="text-xs font-medium no-underline"
          style="color: var(--hs-brand)"
        >
          Upgrade to Pro for 25 endpoints &rarr;
        </router-link>
      </div>
    </div>

    <!-- Usage indicator -->
    <div v-if="store.endpoints.length > 0" class="mb-4 max-w-sm">
      <PlanUsage
        label="Endpoints"
        :current="store.endpoints.length"
        :max="endpointsMax"
      />
      <div class="flex items-center justify-between mt-1">
        <span class="text-xs text-neutral-500">
          {{ isFree ? 'Free' : 'Pro' }} plan: {{ endpointsMax }} endpoints
        </span>
        <router-link
          v-if="isFree"
          to="/settings"
          class="text-xs font-medium no-underline"
          style="color: var(--hs-brand)"
        >
          Upgrade to Pro &rarr;
        </router-link>
      </div>
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
        @duplicate="handleDuplicate"
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

    <!-- Edit dialog -->
    <EndpointEditDialog
      v-model:visible="editDialogVisible"
      :endpoint="editingEndpoint"
      :loading="store.loading"
      @submit="handleEditSubmit"
    />
  </div>
</template>
