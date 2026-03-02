<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import PlanBadge from '../components/settings/PlanBadge.vue'
import PlanUsage from '../components/settings/PlanUsage.vue'
import PlanComparison from '../components/settings/PlanComparison.vue'
import { useAuth } from '../composables/use-auth.js'
import { useUserPlan } from '../composables/use-user-plan.js'

const auth = useAuth()
const { plan, isFree, limits } = useUserPlan()
const toast = useToast()
const route = useRoute()
const router = useRouter()

// Stripe checkout/portal
const checkoutLoading = ref(false)
const portalLoading = ref(false)

const displayName = ref('')
const saving = ref(false)

// Password change
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)

const passwordError = computed(() => {
  if (newPassword.value && newPassword.value.length < 8) {
    return 'New password must be at least 8 characters'
  }
  if (confirmPassword.value && newPassword.value !== confirmPassword.value) {
    return 'Passwords do not match'
  }
  return null
})

const canChangePassword = computed(
  () =>
    currentPassword.value &&
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value &&
    !changingPassword.value,
)

// Account deletion
const showDeleteDialog = ref(false)
const deleteConfirmEmail = ref('')
const deleting = ref(false)

const canDelete = computed(
  () =>
    (deleteConfirmEmail.value === 'DELETE' ||
      deleteConfirmEmail.value === auth.user?.email) &&
    !deleting.value,
)

const endpointsUsed = computed(() => auth.profile?.usage?.endpoints_count || 0)
const endpointsMax = computed(() => limits.value?.max_endpoints || 0)

// Reactively update displayName when profile loads (fixes blank-on-SPA-navigation)
watch(
  () => auth.profile,
  (profile) => {
    if (profile) {
      displayName.value = profile.display_name || ''
    }
  },
)

onMounted(async () => {
  displayName.value = auth.profile?.display_name || ''

  // Ensure profile is loaded on SPA navigation
  if (!auth.profile && auth.session?.access_token) {
    await auth.fetchProfile()
  }

  // Handle checkout return query params
  const checkoutStatus = route.query.checkout
  if (checkoutStatus === 'success') {
    toast.add({
      severity: 'success',
      summary: 'Welcome to Pro!',
      detail: 'Your account has been upgraded.',
      life: 5000,
    })
    await auth.fetchProfile()
    router.replace({ path: '/settings' })
  } else if (checkoutStatus === 'cancel') {
    toast.add({
      severity: 'info',
      summary: 'Checkout Canceled',
      detail: 'You can upgrade anytime.',
      life: 5000,
    })
    router.replace({ path: '/settings' })
  }
})

async function handleUpgrade() {
  checkoutLoading.value = true
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.session?.access_token}`,
      },
    })

    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      const { error } = await res.json()
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error || 'Failed to start checkout',
        life: 5000,
      })
    }
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to start checkout',
      life: 5000,
    })
  } finally {
    checkoutLoading.value = false
  }
}

async function handleManageSubscription() {
  portalLoading.value = true
  try {
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.session?.access_token}`,
      },
    })

    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      const { error } = await res.json()
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error || 'Failed to open billing portal',
        life: 5000,
      })
    }
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to open billing portal',
      life: 5000,
    })
  } finally {
    portalLoading.value = false
  }
}

async function saveDisplayName() {
  saving.value = true
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.session?.access_token}`,
      },
      body: JSON.stringify({ display_name: displayName.value }),
    })

    if (res.ok) {
      await auth.fetchProfile()
      toast.add({
        severity: 'success',
        summary: 'Saved',
        detail: 'Display name updated',
        life: 3000,
      })
    } else {
      const { error } = await res.json()
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error || 'Failed to save',
        life: 5000,
      })
    }
  } finally {
    saving.value = false
  }
}

async function handleChangePassword() {
  changingPassword.value = true
  try {
    const { error } = await auth.changePassword(
      currentPassword.value,
      newPassword.value,
    )
    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to change password',
        life: 5000,
      })
    } else {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      toast.add({
        severity: 'success',
        summary: 'Password Changed',
        detail: 'Your password has been updated successfully',
        life: 3000,
      })
    }
  } finally {
    changingPassword.value = false
  }
}

async function handleDeleteAccount() {
  deleting.value = true
  try {
    const { error } = await auth.deleteAccount()
    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to delete account',
        life: 5000,
      })
    } else {
      showDeleteDialog.value = false
      router.push('/')
    }
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 px-4">
    <h1 class="text-2xl font-bold text-neutral-900 mb-6">Account Settings</h1>

    <!-- Loading state while profile data is not yet available -->
    <template v-if="auth.loading || !auth.profile">
      <Card class="mb-6">
        <template #content>
          <div class="flex flex-col gap-4">
            <Skeleton width="100%" height="2rem" />
            <Skeleton width="60%" height="1.5rem" />
            <Skeleton width="100%" height="2rem" />
          </div>
        </template>
      </Card>
      <Card class="mb-6">
        <template #content>
          <Skeleton width="100%" height="3rem" />
        </template>
      </Card>
    </template>

    <template v-else>
      <!-- Profile Section -->
      <Card class="mb-6">
        <template #title>Profile</template>
        <template #content>
          <div class="flex flex-col gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-600 mb-1"
                >Email</label
              >
              <InputText
                :model-value="auth.user?.email"
                disabled
                class="w-full"
              />
              <small class="text-neutral-400 text-xs"
                >Email cannot be changed</small
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-600 mb-1"
                >Display Name</label
              >
              <div class="flex gap-2">
                <InputText
                  v-model="displayName"
                  placeholder="Enter a display name"
                  class="flex-1"
                  :maxlength="100"
                />
                <Button
                  label="Save"
                  :loading="saving"
                  size="small"
                  @click="saveDisplayName"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Security Section -->
      <Card class="mb-6">
        <template #title>Security</template>
        <template #content>
          <div class="flex flex-col gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-600 mb-1"
                >Current Password</label
              >
              <Password
                v-model="currentPassword"
                :feedback="false"
                toggle-mask
                class="w-full"
                input-class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-600 mb-1"
                >New Password</label
              >
              <Password
                v-model="newPassword"
                :feedback="false"
                toggle-mask
                class="w-full"
                input-class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-600 mb-1"
                >Confirm New Password</label
              >
              <Password
                v-model="confirmPassword"
                :feedback="false"
                toggle-mask
                class="w-full"
                input-class="w-full"
              />
            </div>
            <p v-if="passwordError" class="text-sm text-red-600">
              {{ passwordError }}
            </p>
            <small
              v-else-if="!currentPassword || !newPassword || !confirmPassword"
              class="text-neutral-400 text-xs"
            >
              Enter your current password, new password (min 8 characters), and
              confirm to change.
            </small>
            <div>
              <Button
                label="Change Password"
                :loading="changingPassword"
                :disabled="!canChangePassword"
                size="small"
                @click="handleChangePassword"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Plan Section -->
      <Card class="mb-6">
        <template #title>
          <div class="flex items-center gap-2">
            <span>Your Plan</span>
            <PlanBadge :plan="plan" />
          </div>
        </template>
        <template #content>
          <div class="flex flex-col gap-4">
            <PlanUsage
              label="Endpoints"
              :current="endpointsUsed"
              :max="endpointsMax"
            />
          </div>
        </template>
      </Card>

      <!-- Upgrade CTA for Free users -->
      <Card v-if="isFree" class="mb-6">
        <template #title>Upgrade to Pro</template>
        <template #content>
          <p class="text-sm text-neutral-600 mb-4">
            Get more endpoints, longer log retention, webhook replay, advanced
            search, and custom headers.
          </p>
          <Button
            label="Upgrade to Pro — 5€/month"
            icon="pi pi-bolt"
            :loading="checkoutLoading"
            class="mb-4"
            @click="handleUpgrade"
          />
          <PlanComparison />
        </template>
      </Card>

      <!-- Plan features for Pro users -->
      <Card v-else class="mb-6">
        <template #title>Plan Features</template>
        <template #content>
          <Button
            v-if="auth.profile?.stripe_customer_id"
            label="Manage Subscription"
            icon="pi pi-credit-card"
            severity="secondary"
            :loading="portalLoading"
            class="mb-4"
            @click="handleManageSubscription"
          />
          <PlanComparison />
        </template>
      </Card>

      <!-- Danger Zone -->
      <Card class="mb-6 border border-red-300">
        <template #title>
          <span class="text-red-700">Danger Zone</span>
        </template>
        <template #content>
          <p class="text-sm text-neutral-600 mb-4">
            Permanently delete your account, all endpoints, and webhook logs.
            This action cannot be undone.
          </p>
          <Button
            label="Delete Account"
            severity="danger"
            size="small"
            @click="showDeleteDialog = true"
          />
        </template>
      </Card>

      <!-- Delete Confirmation Dialog -->
      <Dialog
        v-model:visible="showDeleteDialog"
        header="Delete Account"
        :modal="true"
        :style="{ width: '28rem' }"
      >
        <p class="text-sm text-neutral-600 mb-4">
          This will permanently delete your account, all endpoints, and all
          webhook logs. This action cannot be undone.
        </p>
        <p class="text-sm font-medium text-neutral-700 mb-2">
          Type <strong>DELETE</strong> or your email (<strong>{{
            auth.user?.email
          }}</strong
          >) to confirm:
        </p>
        <InputText
          v-model="deleteConfirmEmail"
          class="w-full mb-4"
          placeholder="Type DELETE or your email"
        />
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            size="small"
            @click="showDeleteDialog = false"
          />
          <Button
            label="Delete Account"
            severity="danger"
            size="small"
            :loading="deleting"
            :disabled="!canDelete"
            @click="handleDeleteAccount"
          />
        </div>
      </Dialog>
    </template>
  </div>
</template>
