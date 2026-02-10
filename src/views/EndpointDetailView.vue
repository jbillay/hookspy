<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import EndpointForm from '../components/endpoints/EndpointForm.vue'
import HeaderInjectionEditor from '../components/endpoints/HeaderInjectionEditor.vue'
import { useEndpoints } from '../composables/use-endpoints.js'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const store = useEndpoints()

const endpoint = ref(null)
const loadingEndpoint = ref(false)

const mode = computed(() => (route.name === 'endpoint-new' ? 'create' : 'edit'))

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

async function handleSubmit(form) {
  if (mode.value === 'create') {
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
  } else {
    const { error } = await store.updateEndpoint(route.params.id, form)
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
    router.push({ name: 'endpoints' })
  }
}

function handleCancel() {
  router.push({ name: 'endpoints' })
}
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <div v-if="loadingEndpoint" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>
    <EndpointForm
      v-else
      :endpoint="endpoint"
      :loading="store.loading"
      :mode="mode"
      @submit="handleSubmit"
      @cancel="handleCancel"
    >
      <template #headers="{ form }">
        <HeaderInjectionEditor v-model="form.custom_headers" />
      </template>
    </EndpointForm>
  </div>
</template>
