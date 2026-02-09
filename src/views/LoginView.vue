<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '../composables/use-auth.js'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const auth = useAuth()

const email = ref('')
const password = ref('')

async function handleLogin() {
  if (!email.value || !password.value) return

  const { error } = await auth.signIn(email.value, password.value)

  if (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Invalid email or password',
      life: 5000,
    })
    return
  }

  const redirect = route.query.redirect
  if (redirect) {
    router.push(redirect)
  } else {
    router.push({ name: 'dashboard' })
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <Card class="w-full max-w-md">
      <template #title>Sign In</template>
      <template #content>
        <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
          <div class="flex flex-col gap-1">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label for="password">Password</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              toggle-mask
              input-class="w-full"
            />
          </div>

          <Button
            type="submit"
            label="Sign In"
            :loading="auth.loading"
            :disabled="auth.loading"
            class="w-full"
          />
        </form>
      </template>
      <template #footer>
        <p class="text-center text-sm">
          Don't have an account?
          <router-link to="/register" class="text-primary font-semibold"
            >Create an account</router-link
          >
        </p>
      </template>
    </Card>
  </div>
</template>
