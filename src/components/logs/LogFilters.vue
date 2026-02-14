<script setup>
import { ref, watch, onUnmounted } from 'vue'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ q: '', method: [], status: [], from: null, to: null }),
  },
})

const emit = defineEmits(['update:modelValue', 'clear'])

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const statusOptions = ['pending', 'forwarding', 'responded', 'timeout', 'error']

const localSearch = ref(props.modelValue.q || '')
const localMethod = ref(props.modelValue.method || [])
const localStatus = ref(props.modelValue.status || [])
const dateRange = ref(
  props.modelValue.from
    ? [props.modelValue.from, props.modelValue.to || null]
    : null,
)

let debounceTimer = null

function emitUpdate(overrides = {}) {
  const val = {
    q: localSearch.value,
    method: localMethod.value,
    status: localStatus.value,
    from: dateRange.value?.[0] || null,
    to: dateRange.value?.[1] || null,
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

function onDateChange() {
  emitUpdate()
}

function clearDateRange() {
  dateRange.value = null
  emitUpdate({ from: null, to: null })
}

watch(
  () => props.modelValue,
  (val) => {
    localSearch.value = val.q || ''
    localMethod.value = val.method || []
    localStatus.value = val.status || []
    dateRange.value = val.from ? [val.from, val.to || null] : null
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

    <div>
      <label class="text-xs font-medium text-neutral-500 mb-1 block"
        >Date range</label
      >
      <div class="flex items-center gap-1">
        <DatePicker
          v-model="dateRange"
          selection-mode="range"
          show-time
          hour-format="24"
          placeholder="Select dates"
          date-format="yy-mm-dd"
          class="w-64"
          @date-select="onDateChange"
        />
        <button
          v-if="dateRange"
          class="p-1.5 text-neutral-400 hover:text-neutral-600 bg-transparent border-0 cursor-pointer transition-colors"
          @click="clearDateRange"
        >
          <i class="pi pi-times text-xs" />
        </button>
      </div>
    </div>

    <Button
      v-if="
        localSearch ||
        localMethod.length > 0 ||
        localStatus.length > 0 ||
        dateRange
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
