import { supabase } from './supabase.js'

/**
 * Get plan limits from plan_config table.
 * Uses a simple in-memory cache per serverless invocation (short-lived).
 */
const planCache = new Map()

export async function getPlanLimits(plan) {
  if (planCache.has(plan)) {
    return planCache.get(plan)
  }

  const { data, error } = await supabase
    .from('plan_config')
    .select('*')
    .eq('plan', plan)
    .single()

  if (error || !data) {
    return null
  }

  planCache.set(plan, data)
  return data
}

/**
 * Get a user's plan, role, and status from the profiles table.
 */
export async function getUserPlan(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, role, status')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Check if user can create another endpoint.
 * Returns { allowed, current, max }
 */
export async function checkEndpointLimit(userId) {
  const profile = await getUserPlan(userId)
  if (!profile) {
    return { allowed: false, current: 0, max: 0 }
  }

  const limits = await getPlanLimits(profile.plan)
  if (!limits) {
    return { allowed: false, current: 0, max: 0 }
  }

  const { count, error } = await supabase
    .from('endpoints')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    return { allowed: false, current: 0, max: limits.max_endpoints }
  }

  return {
    allowed: count < limits.max_endpoints,
    current: count,
    max: limits.max_endpoints,
  }
}

/**
 * Check rate limit for an endpoint slug using fixed 1-minute tumbling window.
 * Uses atomic upsert via database RPC function.
 * Returns { allowed, remaining, resetAt }
 */
export async function checkRateLimit(endpointSlug, plan) {
  const limits = await getPlanLimits(plan)
  if (!limits) {
    return { allowed: false, remaining: 0, resetAt: null }
  }

  const now = new Date()
  const windowKey = `${endpointSlug}:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`

  const { data: currentCount, error } = await supabase.rpc(
    'atomic_rate_limit_check',
    { p_key: windowKey },
  )

  if (error) {
    // Fail closed: deny the request on rate limit check failure
    console.error('Rate limit check failed:', error.message)
    return { allowed: false, remaining: 0, resetAt: null }
  }

  // Calculate reset time (next minute boundary)
  const resetAt = new Date(now)
  resetAt.setUTCSeconds(0, 0)
  resetAt.setUTCMinutes(resetAt.getUTCMinutes() + 1)

  return {
    allowed: currentCount <= limits.requests_per_min,
    remaining: Math.max(0, limits.requests_per_min - currentCount),
    resetAt,
  }
}

/**
 * Verify the caller is an admin.
 * Returns { admin: true } or { admin: false, error }.
 */
export async function requireAdmin(profile) {
  if (!profile || profile.role !== 'admin') {
    return { admin: false, error: 'Forbidden: admin access required' }
  }
  return { admin: true, error: null }
}
