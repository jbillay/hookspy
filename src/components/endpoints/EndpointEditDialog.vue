<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import HeaderInjectionEditor from './HeaderInjectionEditor.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  endpoint: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'submit'])

const form = ref({
  name: '',
  target_url: 'http://localhost',
  target_port: 3000,
  target_path: '/',
  timeout_seconds: 30,
  custom_headers: {},
})

const errors = ref({})

watch(
  () => props.endpoint,
  (ep) => {
    if (ep) {
      form.value = {
        name: ep.name || '',
        target_url: ep.target_url || 'http://localhost',
        target_port: ep.target_port || 3000,
        target_path: ep.target_path || '/',
        timeout_seconds: ep.timeout_seconds || 30,
        custom_headers: ep.custom_headers ? { ...ep.custom_headers } : {},
      }
      errors.value = {}
    }
  },
  { immediate: true },
)

function validate() {
  const e = {}
  if (!form.value.name || !form.value.name.trim()) {
    e.name = 'Name is required'
  }
  if (form.value.target_port < 1 || form.value.target_port > 65535) {
    e.target_port = 'Port must be between 1 and 65535'
  }
  if (form.value.timeout_seconds < 1 || form.value.timeout_seconds > 55) {
    e.timeout_seconds = 'Timeout must be between 1 and 55 seconds'
  }
  if (form.value.custom_headers) {
    const keys = Object.keys(form.value.custom_headers)
    for (const key of keys) {
      if (!key.trim()) {
        e.custom_headers = 'Header name cannot be empty'
        break
      }
    }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', { ...form.value })
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Edit Endpoint"
    :style="{ width: '32rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1.5">
        <label for="edit-name" class="text-sm font-medium text-neutral-700"
          >Name</label
        >
        <InputText
          id="edit-name"
          v-model="form.name"
          placeholder="My Webhook"
          :invalid="!!errors.name"
        />
        <small v-if="errors.name" class="text-red-500 text-xs">{{
          errors.name
        }}</small>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="edit-target_url"
          class="text-sm font-medium text-neutral-700"
          >Target URL</label
        >
        <InputText
          id="edit-target_url"
          v-model="form.target_url"
          placeholder="http://localhost"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="edit-target_port"
          class="text-sm font-medium text-neutral-700"
          >Target Port</label
        >
        <InputNumber
          id="edit-target_port"
          v-model="form.target_port"
          :min="1"
          :max="65535"
          :invalid="!!errors.target_port"
        />
        <small v-if="errors.target_port" class="text-red-500 text-xs">{{
          errors.target_port
        }}</small>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="edit-target_path"
          class="text-sm font-medium text-neutral-700"
          >Target Path</label
        >
        <InputText
          id="edit-target_path"
          v-model="form.target_path"
          placeholder="/"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-neutral-700"
          >Timeout ({{ form.timeout_seconds }}s)</label
        >
        <Slider v-model="form.timeout_seconds" :min="1" :max="55" />
        <small v-if="errors.timeout_seconds" class="text-red-500 text-xs">{{
          errors.timeout_seconds
        }}</small>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-neutral-700"
          >Custom Headers</label
        >
        <HeaderInjectionEditor v-model="form.custom_headers" />
      </div>

      <div class="flex gap-2 justify-end pt-2 border-t border-neutral-100">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 bg-transparent border-0 cursor-pointer transition-colors"
          @click="close"
        >
          Cancel
        </button>
        <button type="submit" class="btn-brand" :disabled="loading">
          <i v-if="loading" class="pi pi-spinner pi-spin text-sm" />
          Save Changes
        </button>
      </div>
    </form>
  </Dialog>
</template>
