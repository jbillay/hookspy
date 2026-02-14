<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '../composables/use-auth.js'

const router = useRouter()
const toast = useToast()
const auth = useAuth()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errors = ref({})

function validate() {
  const e = {}
  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    e.email = 'Please enter a valid email address'
  }
  if (!password.value || password.value.length < 6) {
    e.password = 'Password must be at least 6 characters'
  }
  if (password.value !== confirmPassword.value) {
    e.confirmPassword = 'Passwords do not match'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

async function handleRegister() {
  if (!validate()) return

  const { data, error } = await auth.signUp(email.value, password.value)

  if (error) {
    const message = error.message?.includes('already registered')
      ? 'This email is already registered'
      : error.message || 'Registration failed'
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    })
    return
  }

  if (!data?.session) {
    toast.add({
      severity: 'info',
      summary: 'Check your email',
      detail: 'Please confirm your email address to complete registration.',
      life: 10000,
    })
    return
  }

  router.push({ name: 'dashboard' })
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
          Create your account to get started
        </p>
      </div>

      <!-- Form card -->
      <div class="card-surface p-8 shadow-sm">
        <form class="flex flex-col gap-5" @submit.prevent="handleRegister">
          <div class="flex flex-col gap-1.5">
            <label for="email" class="text-sm font-medium text-neutral-700"
              >Email</label
            >
            <InputText
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :invalid="!!errors.email"
              class="w-full"
            />
            <small v-if="errors.email" class="text-red-500 text-xs">{{
              errors.email
            }}</small>
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
              :invalid="!!errors.password"
            />
            <small v-if="errors.password" class="text-red-500 text-xs">{{
              errors.password
            }}</small>
          </div>

          <div class="flex flex-col gap-1.5">
            <label
              for="confirmPassword"
              class="text-sm font-medium text-neutral-700"
              >Confirm Password</label
            >
            <Password
              id="confirmPassword"
              v-model="confirmPassword"
              :feedback="false"
              toggle-mask
              input-class="w-full"
              :invalid="!!errors.confirmPassword"
            />
            <small v-if="errors.confirmPassword" class="text-red-500 text-xs">{{
              errors.confirmPassword
            }}</small>
          </div>

          <Button
            type="submit"
            label="Create Account"
            :loading="auth.loading"
            :disabled="auth.loading"
            class="w-full mt-1"
          />
        </form>
      </div>

      <!-- Footer link -->
      <p class="text-center text-sm text-neutral-500 mt-6">
        Already have an account?
        <router-link
          to="/login"
          class="font-semibold no-underline"
          style="color: var(--hs-brand)"
          >Sign in</router-link
        >
      </p>
    </div>
  </div>
</template>
