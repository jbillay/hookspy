<script setup>
import { ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:modelValue'])

const rows = ref([])

function objectToRows(obj) {
  const entries = Object.entries(obj || {})
  return entries.length > 0
    ? entries.map(([key, value]) => ({ key, value }))
    : []
}

function rowsToObject(rowList) {
  const obj = {}
  for (const row of rowList) {
    if (row.key.trim()) {
      obj[row.key] = row.value
    }
  }
  return obj
}

watch(
  () => props.modelValue,
  (val) => {
    rows.value = objectToRows(val)
  },
  { immediate: true },
)

function emitUpdate() {
  emit('update:modelValue', rowsToObject(rows.value))
}

function addRow() {
  rows.value.push({ key: '', value: '' })
}

function removeRow(index) {
  rows.value.splice(index, 1)
  emitUpdate()
}

function updateKey(index, value) {
  rows.value[index].key = value
  emitUpdate()
}

function updateValue(index, value) {
  rows.value[index].value = value
  emitUpdate()
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <label class="font-semibold">Custom Headers</label>
      <Button
        type="button"
        label="Add Header"
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        @click="addRow"
      />
    </div>

    <div v-if="rows.length === 0" class="text-sm text-surface-500">
      No custom headers configured.
    </div>

    <div
      v-for="(row, index) in rows"
      :key="index"
      class="flex items-center gap-2"
    >
      <InputText
        :model-value="row.key"
        placeholder="Header name"
        class="flex-1"
        @update:model-value="updateKey(index, $event)"
      />
      <InputText
        :model-value="row.value"
        placeholder="Header value"
        class="flex-1"
        @update:model-value="updateValue(index, $event)"
      />
      <Button
        type="button"
        icon="pi pi-times"
        severity="danger"
        text
        size="small"
        aria-label="Remove header"
        @click="removeRow(index)"
      />
    </div>
  </div>
</template>
