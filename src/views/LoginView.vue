<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
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
  <div
    class="min-h-screen flex items-center justify-center px-4"
    style="
      background: linear-gradient(
        135deg,
        #f0fdfa 0%,
        #fafafa 50%,
        #eff6ff 100%
      );
    "
  >
    <div class="w-full max-w-sm">
      <!-- Branding -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2.5 mb-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
            style="background-color: var(--hs-brand)"
          >
            H
          </div>
          <span class="text-2xl font-bold text-neutral-900 font-display"
            >HookSpy</span
          >
        </div>
        <p class="text-sm text-neutral-500">
          Sign in to manage your webhook endpoints
        </p>
      </div>

      <!-- Form card -->
      <div class="card-surface p-8 shadow-sm">
        <form class="flex flex-col gap-5" @submit.prevent="handleLogin">
          <div class="flex flex-col gap-1.5">
            <label for="email" class="text-sm font-medium text-neutral-700"
              >Email</label
            >
            <InputText
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="password" class="text-sm font-medium text-neutral-700"
              >Password</label
            >
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
            class="w-full mt-1"
          />
        </form>
      </div>

      <!-- Footer link -->
      <p class="text-center text-sm text-neutral-500 mt-6">
        Don't have an account?
        <router-link
          to="/register"
          class="font-semibold no-underline"
          style="color: var(--hs-brand)"
          >Create an account</router-link
        >
      </p>
    </div>
  </div>
</template>
