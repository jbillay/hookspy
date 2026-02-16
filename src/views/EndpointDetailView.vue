<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import EndpointForm from '../components/endpoints/EndpointForm.vue'
import EndpointEditDialog from '../components/endpoints/EndpointEditDialog.vue'
import HeaderInjectionEditor from '../components/endpoints/HeaderInjectionEditor.vue'
import LogList from '../components/logs/LogList.vue'
import { useEndpoints } from '../composables/use-endpoints.js'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const store = useEndpoints()

const endpoint = ref(null)
const loadingEndpoint = ref(false)
const editDialogVisible = ref(false)

const mode = computed(() => (route.name === 'endpoint-new' ? 'create' : 'edit'))

const webhookUrl = computed(() => {
  if (!endpoint.value) return ''
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base}/api/hook/${endpoint.value.slug}`
})

onMounted(async () => {
  if (mode.value === 'edit') {
    loadingEndpoint.value = true
    const { data, error } = await store.getEndpoint(route.params.id)
    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error,
        life: 5000,
      })
      router.push({ name: 'endpoints' })
      return
    }
    endpoint.value = data
    loadingEndpoint.value = false
  }
})

async function handleCreate(form) {
  const { error } = await store.createEndpoint(form)
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
    summary: 'Created',
    detail: 'Endpoint created successfully',
    life: 3000,
  })
  router.push({ name: 'endpoints' })
}

async function handleEditSubmit(form) {
  const { data, error } = await store.updateEndpoint(route.params.id, form)
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
  endpoint.value = data
  editDialogVisible.value = false
}

function handleCancel() {
  router.push({ name: 'endpoints' })
}
</script>

<template>
  <div class="page-container">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm mb-6">
      <router-link
        to="/endpoints"
        class="text-neutral-500 hover:text-neutral-700 no-underline transition-colors"
      >
        Endpoints
      </router-link>
      <i class="pi pi-angle-right text-xs text-neutral-400" />
      <span class="text-neutral-800 font-medium">
        {{ mode === 'create' ? 'New Endpoint' : endpoint?.name || '...' }}
      </span>
    </nav>

    <!-- Loading -->
    <div v-if="loadingEndpoint" class="flex justify-center py-16">
      <ProgressSpinner />
    </div>

    <!-- Create mode: show form -->
    <div v-else-if="mode === 'create'" class="max-w-2xl">
      <EndpointForm
        :endpoint="null"
        :loading="store.loading"
        mode="create"
        @submit="handleCreate"
        @cancel="handleCancel"
      >
        <template #headers="{ form }">
          <HeaderInjectionEditor v-model="form.custom_headers" />
        </template>
      </EndpointForm>
    </div>

    <!-- Edit mode: read-only details + logs -->
    <template v-else-if="endpoint">
      <!-- Endpoint info card -->
      <div class="card-surface p-6 mb-8">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-neutral-900">
            {{ endpoint.name }}
          </h2>
          <button class="btn-brand text-sm" @click="editDialogVisible = true">
            <i class="pi pi-pencil text-xs" />
            Edit
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <span class="text-xs font-medium text-neutral-500 block mb-1"
              >Webhook URL</span
            >
            <code
              class="text-sm font-code text-neutral-700 bg-neutral-50 px-3 py-1.5 rounded-lg block truncate"
              >{{ webhookUrl }}</code
            >
          </div>
          <div>
            <span class="text-xs font-medium text-neutral-500 block mb-1"
              >Target</span
            >
            <span class="text-sm text-neutral-800 font-code">
              {{ endpoint.target_url }}:{{ endpoint.target_port
              }}{{ endpoint.target_path }}
            </span>
          </div>
          <div>
            <span class="text-xs font-medium text-neutral-500 block mb-1"
              >Timeout</span
            >
            <span class="text-sm text-neutral-800"
              >{{ endpoint.timeout_seconds }}s</span
            >
          </div>
          <div>
            <span class="text-xs font-medium text-neutral-500 block mb-1"
              >Status</span
            >
            <span class="flex items-center gap-1.5">
              <span
                :class="[
                  'status-dot',
                  endpoint.is_active
                    ? 'status-dot-active'
                    : 'status-dot-inactive',
                ]"
              />
              <span class="text-sm text-neutral-800">{{
                endpoint.is_active ? 'Active' : 'Inactive'
              }}</span>
            </span>
          </div>
        </div>

        <div
          v-if="
            endpoint.custom_headers &&
            Object.keys(endpoint.custom_headers).length > 0
          "
          class="mt-4 pt-4 border-t border-neutral-100"
        >
          <span class="text-xs font-medium text-neutral-500 block mb-2"
            >Custom Headers</span
          >
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(value, key) in endpoint.custom_headers"
              :key="key"
              class="text-xs font-code bg-neutral-50 px-2 py-1 rounded"
            >
              {{ key }}: {{ value }}
            </span>
          </div>
        </div>
      </div>

      <!-- Webhook Logs -->
      <div>
        <h2 class="section-title mb-4">Webhook Logs</h2>
        <LogList :endpoint-id="route.params.id" />
      </div>

      <!-- Edit dialog -->
      <EndpointEditDialog
        v-model:visible="editDialogVisible"
        :endpoint="endpoint"
        :loading="store.loading"
        @submit="handleEditSubmit"
      />
    </template>
  </div>
</template>
