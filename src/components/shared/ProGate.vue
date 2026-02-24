<script setup>
import { computed } from 'vue'
import Tag from 'primevue/tag'
import { useUserPlan } from '../../composables/use-user-plan.js'

const props = defineProps({
  feature: {
    type: String,
    required: true,
    validator: (v) => ['replay', 'search', 'headers'].includes(v),
  },
})

const { canReplay, canSearch, canInjectHeaders } = useUserPlan()

const allowed = computed(() => {
  switch (props.feature) {
    case 'replay':
      return canReplay.value
    case 'search':
      return canSearch.value
    case 'headers':
      return canInjectHeaders.value
    default:
      return false
  }
})
</script>

<template>
  <div class="relative">
    <slot v-if="allowed" />
    <div v-else class="relative">
      <div class="opacity-40 pointer-events-none select-none">
        <slot />
      </div>
      <div class="absolute inset-0 flex items-center justify-center">
        <Tag value="Pro" severity="warning" class="text-xs">
          <template #default>
            <i class="pi pi-lock text-xs mr-1" />
            Pro
          </template>
        </Tag>
      </div>
    </div>
  </div>
</template>
