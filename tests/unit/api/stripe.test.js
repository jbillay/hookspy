import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Stripe
const mockCheckoutSessionsCreate = vi.fn()
const mockBillingPortalSessionsCreate = vi.fn()
const mockWebhooksConstructEvent = vi.fn()
const mockSubscriptionsCancel = vi.fn()

function MockStripe() {
  return {
    checkout: {
      sessions: { create: mockCheckoutSessionsCreate },
    },
    billingPortal: {
      sessions: { create: mockBillingPortalSessionsCreate },
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
    subscriptions: {
      cancel: mockSubscriptionsCancel,
    },
  }
}

vi.mock('stripe', () => ({
  default: MockStripe,
}))

// Mock supabase
const mockSupabaseUpdate = vi.fn()
const mockSupabaseSelect = vi.fn()
const mockSupabaseEq = vi.fn()
const mockSupabaseSingle = vi.fn()

vi.mock('../../../api/_lib/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: (...args) => {
        mockSupabaseUpdate(...args)
        return {
          eq: (...eqArgs) => {
            mockSupabaseEq(...eqArgs)
            return Promise.resolve({ error: null })
          },
        }
      },
      select: (...args) => {
        mockSupabaseSelect(...args)
        return {
          eq: (...eqArgs) => {
            mockSupabaseEq(...eqArgs)
            return {
              single: () => mockSupabaseSingle(),
            }
          },
        }
      },
    }),
  },
}))

// Mock auth
const mockVerifyAuth = vi.fn()
vi.mock('../../../api/_lib/auth.js', () => ({
  verifyAuth: (...args) => mockVerifyAuth(...args),
}))

// Mock cors
vi.mock('../../../api/_lib/cors.js', () => ({
  setCorsHeaders: vi.fn(),
}))

// Mock downgradeToFree
const mockDowngradeToFree = vi.fn()
vi.mock('../../../api/_lib/plans.js', () => ({
  downgradeToFree: (...args) => mockDowngradeToFree(...args),
}))

function createMockReq({
  method = 'POST',
  route = 'checkout',
  headers = {},
  body = '',
} = {}) {
  const chunks = [
    Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
  ]
  return {
    method,
    query: { _route: route },
    headers,
    on: vi.fn((event, cb) => {
      if (event === 'data') chunks.forEach((c) => cb(c))
      if (event === 'end') cb()
    }),
  }
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn((code) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((data) => {
      res.body = data
      return res
    }),
    end: vi.fn(),
  }
  return res
}

describe('Stripe API handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    process.env.STRIPE_PRICE_ID = 'price_test_123'
    process.env.APP_URL = 'https://hookspy.dev'
  })

  describe('Method validation', () => {
    it('rejects non-POST requests', async () => {
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
    })

    it('responds 200 to OPTIONS (CORS preflight)', async () => {
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ method: 'OPTIONS' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('Checkout route', () => {
    it('rejects missing auth', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: null,
        profile: null,
        error: 'Missing or invalid Authorization header',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'checkout' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('rejects already-subscribed user', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'pro',
          stripe_subscription_id: 'sub_123',
          email: 'test@test.com',
        },
        error: null,
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'checkout' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toMatch(/Already subscribed/)
    })

    it('creates session with customer_email for new users', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'free',
          stripe_subscription_id: null,
          stripe_customer_id: null,
          email: 'test@test.com',
        },
        error: null,
      })
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/session',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'checkout' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.url).toBe('https://checkout.stripe.com/session')
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'test@test.com',
          mode: 'subscription',
          client_reference_id: 'user-1',
        }),
      )
    })

    it('creates session with customer ID for returning users', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'free',
          stripe_subscription_id: null,
          stripe_customer_id: 'cus_123',
          email: 'test@test.com',
        },
        error: null,
      })
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/session',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'checkout' })
      const res = createMockRes()

      await handler(req, res)

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
        }),
      )
      expect(
        mockCheckoutSessionsCreate.mock.calls[0][0].customer_email,
      ).toBeUndefined()
    })

    it('returns 500 when Stripe session creation fails', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'free',
          stripe_subscription_id: null,
          stripe_customer_id: null,
          email: 'test@test.com',
        },
        error: null,
      })
      mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'checkout' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      consoleSpy.mockRestore()
    })
  })

  describe('Portal route', () => {
    it('rejects missing auth', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: null,
        profile: null,
        error: 'Missing or invalid Authorization header',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'portal' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('rejects user without stripe_customer_id (admin-promoted)', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: { plan: 'pro', stripe_customer_id: null },
        error: null,
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'portal' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toMatch(/No billing account/)
    })

    it('creates portal session for user with stripe_customer_id', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: { plan: 'pro', stripe_customer_id: 'cus_123' },
        error: null,
      })
      mockBillingPortalSessionsCreate.mockResolvedValue({
        url: 'https://billing.stripe.com/portal',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'portal' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body.url).toBe('https://billing.stripe.com/portal')
      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          return_url: 'https://hookspy.dev/settings',
        }),
      )
    })
  })

  describe('Webhook route', () => {
    it('rejects invalid signature', async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'bad-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toMatch(/Webhook Error/)
      consoleSpy.mockRestore()
    })

    it('processes checkout.session.completed and updates profile to pro', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'user-1',
            customer: 'cus_123',
            subscription: 'sub_456',
          },
        },
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body).toEqual({ received: true })
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'pro',
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_456',
        }),
      )
    })

    it('handles missing client_reference_id gracefully', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: null,
            customer: 'cus_123',
            subscription: 'sub_456',
          },
        },
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing client_reference_id'),
      )
      consoleSpy.mockRestore()
    })

    it('subscription.updated with canceled status triggers downgrade', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_123',
            status: 'canceled',
          },
        },
      })
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 'user-1', plan: 'pro' },
        error: null,
      })
      mockDowngradeToFree.mockResolvedValue({ endpointsDeactivated: 0 })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockDowngradeToFree).toHaveBeenCalledWith('user-1')
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('subscription.updated with active status sets plan to pro', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_123',
            status: 'active',
          },
        },
      })
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 'user-1', plan: 'free' },
        error: null,
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'pro' }),
      )
    })

    it('subscription.deleted triggers downgrade and clears stripe_subscription_id', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_123',
          },
        },
      })
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 'user-1' },
        error: null,
      })
      mockDowngradeToFree.mockResolvedValue({ endpointsDeactivated: 1 })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockDowngradeToFree).toHaveBeenCalledWith('user-1')
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({
        stripe_subscription_id: null,
      })
    })

    it('invoice.payment_failed is logged but no plan change', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_123',
            id: 'inv_123',
            amount_due: 500,
          },
        },
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(consoleSpy).toHaveBeenCalled()
      expect(mockDowngradeToFree).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      consoleSpy.mockRestore()
    })

    it('unhandled event types return 200', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'some.unknown.event',
        data: { object: {} },
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body).toEqual({ received: true })
      consoleSpy.mockRestore()
    })

    it('processing checkout.session.completed twice is idempotent', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'user-1',
            customer: 'cus_123',
            subscription: 'sub_456',
          },
        },
      })

      const { default: handler } = await import('../../../api/stripe/index.js')

      const req1 = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid' },
        body: '{}',
      })
      const res1 = createMockRes()
      await handler(req1, res1)

      const req2 = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid' },
        body: '{}',
      })
      const res2 = createMockRes()
      await handler(req2, res2)

      // Both should succeed (update is idempotent)
      expect(res1.status).toHaveBeenCalledWith(200)
      expect(res2.status).toHaveBeenCalledWith(200)
      expect(mockSupabaseUpdate).toHaveBeenCalledTimes(2)
    })

    it('downgrading an already-free user is a no-op', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_123',
            status: 'canceled',
          },
        },
      })
      mockSupabaseSingle.mockResolvedValue({
        data: { id: 'user-1', plan: 'free' },
        error: null,
      })
      mockDowngradeToFree.mockResolvedValue({ endpointsDeactivated: 0 })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({
        route: 'webhook',
        headers: { 'stripe-signature': 'valid-sig' },
        body: '{}',
      })
      const res = createMockRes()

      await handler(req, res)

      // Still calls downgradeToFree (it's idempotent)
      expect(mockDowngradeToFree).toHaveBeenCalledWith('user-1')
      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('Cancel route', () => {
    it('rejects missing auth', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: null,
        profile: null,
        error: 'Missing or invalid Authorization header',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'cancel' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('rejects free user without subscription', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'free',
          stripe_subscription_id: null,
        },
        error: null,
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'cancel' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toMatch(/No active Pro subscription/)
    })

    it('rejects pro user without stripe_subscription_id (admin-promoted)', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'pro',
          stripe_subscription_id: null,
        },
        error: null,
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'cancel' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.body.error).toMatch(/No active Pro subscription/)
    })

    it('cancels subscription for pro user with active subscription', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'pro',
          stripe_subscription_id: 'sub_123',
        },
        error: null,
      })
      mockSubscriptionsCancel.mockResolvedValue({
        id: 'sub_123',
        status: 'canceled',
      })

      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'cancel' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.body).toEqual({ success: true })
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_123')
    })

    it('returns 500 when Stripe cancel fails', async () => {
      mockVerifyAuth.mockResolvedValue({
        user: { id: 'user-1' },
        profile: {
          plan: 'pro',
          stripe_subscription_id: 'sub_123',
        },
        error: null,
      })
      mockSubscriptionsCancel.mockRejectedValue(new Error('Stripe error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'cancel' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.body.error).toMatch(/Failed to cancel/)
      consoleSpy.mockRestore()
    })
  })

  describe('Route not found', () => {
    it('returns 404 for unknown routes', async () => {
      const { default: handler } = await import('../../../api/stripe/index.js')
      const req = createMockReq({ route: 'unknown' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })
  })
})
