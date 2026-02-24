<script setup>
import { ref, onMounted, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useToast } from 'primevue/usetoast'
import PlanBadge from '../components/settings/PlanBadge.vue'
import PlanUsage from '../components/settings/PlanUsage.vue'
import PlanComparison from '../components/settings/PlanComparison.vue'
import { useAuth } from '../composables/use-auth.js'
import { useUserPlan } from '../composables/use-user-plan.js'

const auth = useAuth()
const { plan, isFree, limits } = useUserPlan()
const toast = useToast()

const displayName = ref('')
const saving = ref(false)

const endpointsUsed = computed(() => auth.profile?.usage?.endpoints_count || 0)
const endpointsMax = computed(() => limits.value?.max_endpoints || 0)

onMounted(() => {
  displayName.value = auth.profile?.display_name || ''
})

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
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 px-4">
    <h1 class="text-2xl font-bold text-neutral-900 mb-6">Account Settings</h1>

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
          search, and custom headers. Contact an admin to upgrade your account.
        </p>
        <PlanComparison />
      </template>
    </Card>

    <!-- Plan comparison for Pro users -->
    <Card v-else class="mb-6">
      <template #title>Plan Features</template>
      <template #content>
        <PlanComparison />
      </template>
    </Card>
  </div>
</template>
