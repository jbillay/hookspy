<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import AppHeader from './AppHeader.vue'
import RelayWorker from '../relay/RelayWorker.vue'
import { useAuth } from '../../composables/use-auth.js'

const route = useRoute()
const auth = useAuth()

const GUEST_ROUTES = ['login', 'register', 'home']

const showHeader = computed(
  () => auth.isAuthenticated && !GUEST_ROUTES.includes(route.name),
)
</script>

<template>
  <div class="min-h-screen">
    <AppHeader v-if="showHeader" />
    <RelayWorker v-if="showHeader" />
    <slot />
  </div>
</template>
