import { computed } from 'vue'
import { useAuth } from './use-auth.js'
import { useSupabase } from './use-supabase.js'

export function useOnboarding() {
  const auth = useAuth()
  const { client } = useSupabase()

  const shouldShowTour = computed(
    () => auth.profile && !auth.profile.onboarding_completed_at,
  )

  async function completeTour() {
    if (!auth.user?.id) return

    await client
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', auth.user.id)

    // Refresh profile to update local state
    await auth.fetchProfile()
  }

  return {
    shouldShowTour,
    completeTour,
  }
}
