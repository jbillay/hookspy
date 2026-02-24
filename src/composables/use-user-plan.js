import { computed, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useSupabase } from './use-supabase.js'

const planLimits = ref(null)
let lastPlan = null

export function useUserPlan() {
  const authStore = useAuthStore()
  const { client } = useSupabase()

  const profile = computed(() => authStore.profile)
  const plan = computed(() => profile.value?.plan || 'free')
  const role = computed(() => profile.value?.role || 'user')

  const isPro = computed(() => plan.value === 'pro')
  const isFree = computed(() => plan.value === 'free')
  const isAdmin = computed(() => role.value === 'admin')

  const limits = computed(() => planLimits.value)
  const canReplay = computed(() => planLimits.value?.can_replay || false)
  const canSearch = computed(() => planLimits.value?.can_search || false)
  const canInjectHeaders = computed(
    () => planLimits.value?.can_inject_headers || false,
  )

  const endpointsMax = computed(() => planLimits.value?.max_endpoints || 0)

  async function fetchPlanLimits() {
    const currentPlan = plan.value
    if (currentPlan === lastPlan && planLimits.value) return

    const { data, error } = await client
      .from('plan_config')
      .select('*')
      .eq('plan', currentPlan)
      .single()

    if (!error && data) {
      planLimits.value = data
      lastPlan = currentPlan
    }
  }

  watch(
    plan,
    () => {
      fetchPlanLimits()
    },
    { immediate: true },
  )

  return {
    profile,
    plan,
    role,
    isPro,
    isFree,
    isAdmin,
    limits,
    canReplay,
    canSearch,
    canInjectHeaders,
    endpointsMax,
    fetchPlanLimits,
  }
}
