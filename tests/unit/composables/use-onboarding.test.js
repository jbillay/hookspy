import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// Mock dependencies
const mockFetchProfile = vi.fn()
const mockEq = vi.fn(() => Promise.resolve({ error: null }))
const mockSupabaseUpdate = vi.fn(() => ({
  eq: mockEq,
}))

const mockAuth = reactive({
  profile: null,
  user: null,
  fetchProfile: mockFetchProfile,
})

vi.mock('../../../src/composables/use-auth.js', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      from: () => ({
        update: mockSupabaseUpdate,
      }),
    },
  }),
}))

// Import after mocks
const { useOnboarding } =
  await import('../../../src/composables/use-onboarding.js')

describe('useOnboarding', () => {
  beforeEach(() => {
    mockAuth.profile = null
    mockAuth.user = null
    mockFetchProfile.mockClear()
    mockSupabaseUpdate.mockClear()
    mockEq.mockClear()
  })

  it('shouldShowTour returns true when onboarding_completed_at is null', () => {
    mockAuth.profile = { onboarding_completed_at: null }
    const { shouldShowTour } = useOnboarding()
    expect(shouldShowTour.value).toBe(true)
  })

  it('shouldShowTour returns false when onboarding_completed_at is set', () => {
    mockAuth.profile = {
      onboarding_completed_at: '2026-03-01T00:00:00Z',
    }
    const { shouldShowTour } = useOnboarding()
    expect(shouldShowTour.value).toBe(false)
  })

  it('shouldShowTour returns false when profile is null', () => {
    mockAuth.profile = null
    const { shouldShowTour } = useOnboarding()
    expect(shouldShowTour.value).toBeFalsy()
  })

  it('completeTour calls Supabase update and fetchProfile', async () => {
    mockAuth.user = { id: 'user-123' }
    mockAuth.profile = { onboarding_completed_at: null }

    const { completeTour } = useOnboarding()
    await completeTour()

    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding_completed_at: expect.any(String),
      }),
    )
    expect(mockFetchProfile).toHaveBeenCalled()
  })

  it('completeTour does nothing when user is not authenticated', async () => {
    mockAuth.user = null
    const { completeTour } = useOnboarding()
    await completeTour()

    expect(mockSupabaseUpdate).not.toHaveBeenCalled()
    expect(mockFetchProfile).not.toHaveBeenCalled()
  })
})
