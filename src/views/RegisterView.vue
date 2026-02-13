<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Card from 'primevue/card'
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
  <div class="flex items-center justify-center min-h-screen">
    <Card class="w-full max-w-md">
      <template #title>Create an Account</template>
      <template #content>
        <form class="flex flex-col gap-4" @submit.prevent="handleRegister">
          <div class="flex flex-col gap-1">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :invalid="!!errors.email"
            />
            <small v-if="errors.email" class="text-red-500">{{
              errors.email
            }}</small>
          </div>

          <div class="flex flex-col gap-1">
            <label for="password">Password</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              toggle-mask
              input-class="w-full"
              :invalid="!!errors.password"
            />
            <small v-if="errors.password" class="text-red-500">{{
              errors.password
            }}</small>
          </div>

          <div class="flex flex-col gap-1">
            <label for="confirmPassword">Confirm Password</label>
            <Password
              id="confirmPassword"
              v-model="confirmPassword"
              :feedback="false"
              toggle-mask
              input-class="w-full"
              :invalid="!!errors.confirmPassword"
            />
            <small v-if="errors.confirmPassword" class="text-red-500">{{
              errors.confirmPassword
            }}</small>
          </div>

          <Button
            type="submit"
            label="Create Account"
            :loading="auth.loading"
            :disabled="auth.loading"
            class="w-full"
          />
        </form>
      </template>
      <template #footer>
        <p class="text-center text-sm">
          Already have an account?
          <router-link to="/login" class="text-primary font-semibold"
            >Sign in</router-link
          >
        </p>
      </template>
    </Card>
  </div>
</template>
