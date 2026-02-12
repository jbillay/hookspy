<script setup>
import { computed, ref } from 'vue'
import Button from 'primevue/button'

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
})

const showRaw = ref(false)
const showFull = ref(false)

const TRUNCATE_THRESHOLD = 102400

const isJson = computed(() => {
  if (!props.content) return false
  try {
    JSON.parse(props.content)
    return true
  } catch {
    return false
  }
})

const isTruncated = computed(
  () => props.content && props.content.length > TRUNCATE_THRESHOLD,
)

const displayContent = computed(() => {
  if (!props.content) return ''
  if (isTruncated.value && !showFull.value) {
    return props.content.slice(0, TRUNCATE_THRESHOLD)
  }
  return props.content
})

const prettyJson = computed(() => {
  if (!isJson.value || showRaw.value) return null
  try {
    return JSON.stringify(JSON.parse(displayContent.value), null, 2)
  } catch {
    return displayContent.value
  }
})

function highlightJson(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="json-key">$1</span>:')
    .replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="json-string">$1</span>',
    )
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
}
</script>

<template>
  <div class="payload-viewer">
    <div v-if="!content" class="text-surface-400 text-sm italic">No body</div>
    <div v-else>
      <div v-if="isJson" class="flex gap-1 mb-2">
        <Button
          :label="showRaw ? 'Pretty' : 'Raw'"
          severity="secondary"
          text
          size="small"
          @click="showRaw = !showRaw"
        />
      </div>
      <div
        class="bg-surface-50 border border-surface-200 rounded p-3 overflow-auto max-h-96 text-sm font-mono"
      >
        <pre
          v-if="prettyJson"
          class="whitespace-pre-wrap m-0"
          v-html="highlightJson(prettyJson)"
        ></pre>
        <pre v-else class="whitespace-pre-wrap m-0">{{ displayContent }}</pre>
      </div>
      <div v-if="isTruncated" class="mt-2">
        <Button
          :label="showFull ? 'Collapse' : 'Show full body'"
          severity="secondary"
          text
          size="small"
          @click="showFull = !showFull"
        />
      </div>
    </div>
  </div>
</template>

<style>
.json-key {
  color: #881391;
}
.json-string {
  color: #1a6b1a;
}
.json-number {
  color: #1a1ae6;
}
.json-boolean {
  color: #d97706;
}
.json-null {
  color: #9ca3af;
}
</style>
