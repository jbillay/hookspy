import Stripe from 'stripe'
import { supabase } from '../_lib/supabase.js'
import { verifyAuth } from '../_lib/auth.js'
import { setCorsHeaders } from '../_lib/cors.js'
import { downgradeToFree } from '../_lib/plans.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

/**
 * Read the raw body from a request as a Buffer.
 * Required for Stripe webhook signature verification.
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const route = req.query._route

  if (route === 'webhook') {
    return handleWebhook(req, res)
  }

  if (route === 'checkout') {
    return handleCheckout(req, res)
  }

  if (route === 'portal') {
    return handlePortal(req, res)
  }

  return res.status(404).json({ error: 'Not found' })
}

// --- Route: checkout ---

async function handleCheckout(req, res) {
  await getRawBody(req)

  const { user, profile, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  if (profile.plan === 'pro' && profile.stripe_subscription_id) {
    return res.status(400).json({ error: 'Already subscribed to Pro' })
  }

  try {
    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${process.env.APP_URL}/settings?checkout=success`,
      cancel_url: `${process.env.APP_URL}/settings?checkout=cancel`,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
    }

    if (profile.stripe_customer_id) {
      sessionParams.customer = profile.stripe_customer_id
    } else {
      sessionParams.customer_email = profile.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Failed to create checkout session:', err.type, err.message)
    return res
      .status(500)
      .json({ error: 'Failed to create checkout session', detail: err.message })
  }
}

// --- Route: portal ---

async function handlePortal(req, res) {
  await getRawBody(req)

  const { user, profile, error: authError } = await verifyAuth(req)
  if (authError || !user) {
    return res.status(401).json({ error: authError })
  }

  if (!profile.stripe_customer_id) {
    return res.status(400).json({ error: 'No billing account found' })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.APP_URL}/settings`,
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Failed to create portal session:', err.message)
    return res.status(500).json({ error: 'Failed to create portal session' })
  }
}

// --- Route: webhook ---

async function handleWebhook(req, res) {
  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object)
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object)
      break

    default:
      console.log(`Unhandled webhook event type: ${event.type}`)
  }

  return res.status(200).json({ received: true })
}

// --- Webhook event handlers ---

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id
  const stripeCustomerId = session.customer
  const stripeSubscriptionId = session.subscription

  if (!userId) {
    console.error('checkout.session.completed: missing client_reference_id')
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      plan: 'pro',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      plan_changed_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error(
      'checkout.session.completed: profile update failed:',
      error.message,
    )
  }
}

async function handleSubscriptionUpdated(subscription) {
  const stripeCustomerId = subscription.customer
  const status = subscription.status

  const { data: user, error: lookupError } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (lookupError || !user) {
    console.error(
      'subscription.updated: user not found for customer',
      stripeCustomerId,
    )
    return
  }

  if (status === 'active') {
    if (user.plan !== 'pro') {
      await supabase
        .from('profiles')
        .update({ plan: 'pro', plan_changed_at: new Date().toISOString() })
        .eq('id', user.id)
    }
  } else if (['canceled', 'past_due', 'unpaid'].includes(status)) {
    await downgradeToFree(user.id)
    await supabase
      .from('profiles')
      .update({ stripe_subscription_id: null })
      .eq('id', user.id)
  }
}

async function handleSubscriptionDeleted(subscription) {
  const stripeCustomerId = subscription.customer

  const { data: user, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (lookupError || !user) {
    console.error(
      'subscription.deleted: user not found for customer',
      stripeCustomerId,
    )
    return
  }

  await downgradeToFree(user.id)
  await supabase
    .from('profiles')
    .update({ stripe_subscription_id: null })
    .eq('id', user.id)
}

async function handlePaymentFailed(invoice) {
  const stripeCustomerId = invoice.customer
  console.error(
    `invoice.payment_failed for customer ${stripeCustomerId}:`,
    `invoice ${invoice.id}, amount_due: ${invoice.amount_due}`,
  )
}
