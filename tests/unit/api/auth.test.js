import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockGetUser(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockProfileSingle(),
        }),
      }),
    }),
  },
}))

const { verifyAuth } = await import('../../../api/_lib/auth.js')

describe('verifyAuth', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockProfileSingle.mockReset()
    mockProfileSingle.mockResolvedValue({
      data: { plan: 'free', role: 'user', status: 'active' },
      error: null,
    })
  })

  it('returns user on valid token', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const req = { headers: { authorization: 'Bearer valid-token' } }
    const result = await verifyAuth(req)

    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeNull()
    expect(mockGetUser).toHaveBeenCalledWith('valid-token')
  })

  it('returns error when Authorization header is missing', async () => {
    const req = { headers: {} }
    const result = await verifyAuth(req)

    expect(result.user).toBeNull()
    expect(result.error).toBe('Missing or invalid Authorization header')
  })

  it('returns error when Authorization header has wrong format', async () => {
    const req = { headers: { authorization: 'Basic abc123' } }
    const result = await verifyAuth(req)

    expect(result.user).toBeNull()
    expect(result.error).toBe('Missing or invalid Authorization header')
  })

  it('returns error when token is invalid', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    })

    const req = { headers: { authorization: 'Bearer invalid-token' } }
    const result = await verifyAuth(req)

    expect(result.user).toBeNull()
    expect(result.error).toBe('Invalid or expired token')
  })
})
