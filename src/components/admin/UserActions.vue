<script setup>
import { ref } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useAdminStore } from '../../stores/admin.js'
import { useAuthStore } from '../../stores/auth.js'

const props = defineProps({
  user: { type: Object, required: true },
})

const emit = defineEmits(['refresh'])

const confirm = useConfirm()
const toast = useToast()
const adminStore = useAdminStore()
const authStore = useAuthStore()

const planOptions = [
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
]

const changingPlan = ref(false)
const changingStatus = ref(false)

const isSelf = props.user.id === authStore.user?.id

function handlePlanChange(newPlan) {
  if (newPlan === props.user.plan) return

  const downgrading = newPlan === 'free' && props.user.plan === 'pro'
  const message = downgrading
    ? `Downgrade ${props.user.email} to Free? Excess active endpoints will be deactivated.`
    : `Upgrade ${props.user.email} to Pro?`

  confirm.require({
    message,
    header: 'Change Plan',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Confirm',
    rejectLabel: 'Cancel',
    accept: async () => {
      changingPlan.value = true
      const result = await adminStore.changePlan(props.user.id, newPlan)
      changingPlan.value = false

      if (result.error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: result.error,
          life: 5000,
        })
        return
      }

      let detail = `Plan changed to ${newPlan}`
      if (result.endpoints_deactivated > 0) {
        detail += ` (${result.endpoints_deactivated} endpoints deactivated)`
      }
      toast.add({ severity: 'success', summary: 'Updated', detail, life: 3000 })
      emit('refresh')
    },
  })
}

function handleStatusToggle() {
  const newStatus = props.user.status === 'active' ? 'disabled' : 'active'
  const message =
    newStatus === 'disabled'
      ? `Disable ${props.user.email}? They will be signed out on their next request.`
      : `Re-enable ${props.user.email}?`

  confirm.require({
    message,
    header: newStatus === 'disabled' ? 'Disable User' : 'Enable User',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Confirm',
    rejectLabel: 'Cancel',
    acceptClass:
      newStatus === 'disabled' ? 'p-button-danger' : 'p-button-success',
    accept: async () => {
      changingStatus.value = true
      const { error } = await adminStore.changeStatus(props.user.id, newStatus)
      changingStatus.value = false

      if (error) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: error,
          life: 5000,
        })
        return
      }

      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: `User ${newStatus === 'disabled' ? 'disabled' : 'enabled'}`,
        life: 3000,
      })
      emit('refresh')
    },
  })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Select
      :model-value="user.plan"
      :options="planOptions"
      option-label="label"
      option-value="value"
      :disabled="isSelf || changingPlan"
      class="w-24 text-xs"
      @update:model-value="handlePlanChange"
    />
    <Button
      :label="user.status === 'active' ? 'Disable' : 'Enable'"
      :severity="user.status === 'active' ? 'danger' : 'success'"
      text
      size="small"
      :disabled="isSelf || changingStatus"
      :loading="changingStatus"
      @click="handleStatusToggle"
    />
  </div>
</template>
