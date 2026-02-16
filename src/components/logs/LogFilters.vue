<script setup>
import { ref, watch, onUnmounted } from 'vue'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      q: '',
      method: [],
      status: [],
      endpointIds: [],
      from: null,
      to: null,
    }),
  },
  endpoints: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'clear'])

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const statusOptions = ['pending', 'forwarding', 'responded', 'timeout', 'error']

const localSearch = ref(props.modelValue.q || '')
const localMethod = ref(props.modelValue.method || [])
const localStatus = ref(props.modelValue.status || [])
const localEndpointIds = ref(props.modelValue.endpointIds || [])

let debounceTimer = null

function emitUpdate(overrides = {}) {
  const val = {
    q: localSearch.value,
    method: localMethod.value,
    status: localStatus.value,
    endpointIds: localEndpointIds.value,
    from: null,
    to: null,
    ...overrides,
  }
  emit('update:modelValue', val)
}

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emitUpdate()
  }, 300)
}

function onMethodChange() {
  emitUpdate()
}

function onStatusChange() {
  emitUpdate()
}

function onEndpointChange() {
  emitUpdate()
}

watch(
  () => props.modelValue,
  (val) => {
    localSearch.value = val.q || ''
    localMethod.value = val.method || []
    localStatus.value = val.status || []
    localEndpointIds.value = val.endpointIds || []
  },
)

onUnmounted(() => {
  clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="card-surface p-4 mb-4 flex flex-wrap gap-3 items-end">
    <div class="flex-1 min-w-48">
      <label class="text-xs font-medium text-neutral-500 mb-1 block"
        >Search</label
      >
      <InputText
        v-model="localSearch"
        placeholder="Search logs..."
        class="w-full"
        @input="onSearchInput"
      />
    </div>

    <div v-if="endpoints.length > 0">
      <label class="text-xs font-medium text-neutral-500 mb-1 block"
        >Endpoint</label
      >
      <MultiSelect
        v-model="localEndpointIds"
        :options="endpoints"
        option-label="name"
        option-value="id"
        placeholder="All endpoints"
        display="chip"
        class="w-56"
        @change="onEndpointChange"
      />
    </div>

    <div>
      <label class="text-xs font-medium text-neutral-500 mb-1 block"
        >Method</label
      >
      <MultiSelect
        v-model="localMethod"
        :options="methodOptions"
        placeholder="All methods"
        display="chip"
        class="w-48"
        @change="onMethodChange"
      />
    </div>

    <div>
      <label class="text-xs font-medium text-neutral-500 mb-1 block"
        >Status</label
      >
      <MultiSelect
        v-model="localStatus"
        :options="statusOptions"
        placeholder="All statuses"
        display="chip"
        class="w-48"
        @change="onStatusChange"
      />
    </div>

    <Button
      v-if="
        localSearch ||
        localMethod.length > 0 ||
        localStatus.length > 0 ||
        localEndpointIds.length > 0
      "
      label="Clear"
      icon="pi pi-filter-slash"
      severity="secondary"
      text
      size="small"
      @click="emit('clear')"
    />
  </div>
</template>
