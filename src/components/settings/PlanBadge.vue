<script setup>
import Tag from 'primevue/tag'

defineProps({
  plan: {
    type: String,
    default: 'free',
  },
})
</script>

<template>
  <Tag
    :value="plan === 'pro' ? 'Pro' : 'Free'"
    :severity="plan === 'pro' ? 'success' : 'secondary'"
    class="text-xs"
  />
</template>
