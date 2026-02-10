<script setup>
import { ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import Card from 'primevue/card'

const props = defineProps({
  endpoint: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'create',
    validator: (v) => ['create', 'edit'].includes(v),
  },
})

const emit = defineEmits(['submit', 'cancel'])

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
        custom_headers: ep.custom_headers || {},
      }
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
</script>

<template>
  <Card>
    <template #title>
      {{ mode === 'create' ? 'Create Endpoint' : 'Edit Endpoint' }}
    </template>
    <template #content>
      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-1">
          <label for="name">Name</label>
          <InputText
            id="name"
            v-model="form.name"
            placeholder="My Webhook"
            :invalid="!!errors.name"
          />
          <small v-if="errors.name" class="text-red-500">{{
            errors.name
          }}</small>
        </div>

        <div class="flex flex-col gap-1">
          <label for="target_url">Target URL</label>
          <InputText
            id="target_url"
            v-model="form.target_url"
            placeholder="http://localhost"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="target_port">Target Port</label>
          <InputNumber
            id="target_port"
            v-model="form.target_port"
            :min="1"
            :max="65535"
            :invalid="!!errors.target_port"
          />
          <small v-if="errors.target_port" class="text-red-500">{{
            errors.target_port
          }}</small>
        </div>

        <div class="flex flex-col gap-1">
          <label for="target_path">Target Path</label>
          <InputText
            id="target_path"
            v-model="form.target_path"
            placeholder="/"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label>Timeout ({{ form.timeout_seconds }}s)</label>
          <Slider v-model="form.timeout_seconds" :min="1" :max="55" />
          <small v-if="errors.timeout_seconds" class="text-red-500">{{
            errors.timeout_seconds
          }}</small>
        </div>

        <slot name="headers" :form="form" :errors="errors" />

        <div class="flex gap-2 justify-end">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            @click="emit('cancel')"
          />
          <Button
            type="submit"
            :label="mode === 'create' ? 'Create Endpoint' : 'Save Changes'"
            :loading="loading"
            :disabled="loading"
          />
        </div>
      </form>
    </template>
  </Card>
</template>
