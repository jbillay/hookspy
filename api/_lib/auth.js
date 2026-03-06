import { supabase } from './supabase.js'

export async function verifyAuth(req) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      profile: null,
      error: 'Missing or invalid Authorization header',
    }
  }

  const token = authHeader.replace('Bearer ', '')

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { user: null, profile: null, error: 'Invalid or expired token' }
  }

  // Fetch profile with plan/role/status for lazy invalidation
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'plan, role, status, email, stripe_customer_id, stripe_subscription_id',
    )
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { user: null, profile: null, error: 'User profile not found' }
  }

  // Lazy session invalidation: disabled users are rejected
  if (profile.status === 'disabled') {
    return { user: null, profile: null, error: 'account_disabled' }
  }

  return { user, profile, error: null }
}
