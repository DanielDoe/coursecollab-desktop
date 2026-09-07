import { type NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"

/** Events this app is willing to act on. Signed but unknown types are acknowledged, not fulfilled. */
export const STRIPE_WEBHOOK_ALLOWED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "payment_intent.succeeded",
])

export const WEBHOOK_FAIL_RATE_LIMIT = { limit: 40, windowMs: 10 * 60 * 1000 }

export function readStripeWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = String(env.STRIPE_WEBHOOK_SECRET ?? "").trim()
  if (!secret.startsWith("whsec_")) return null
  return secret
}

export function stripeEventLivemodeAllowed(
  eventLivemode: boolean,
  secretKey: string,
): boolean {
  const key = secretKey.trim()
  if (key.startsWith("sk_live_")) return eventLivemode === true
  if (key.startsWith("sk_test_")) return eventLivemode === false
  return false
}

function failedSignatureResponse(request: NextRequest, status: number, error: string) {
  const limited = checkRateLimit(
    rateLimitKey(request, "stripe-webhook-fail"),
    WEBHOOK_FAIL_RATE_LIMIT.limit,
    WEBHOOK_FAIL_RATE_LIMIT.windowMs,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many invalid webhook attempts" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    )
  }
  return NextResponse.json({ error }, { status })
}

export async function verifyStripeWebhookRequest(
  request: NextRequest,
): Promise<{ ok: true; event: Stripe.Event } | { ok: false; response: NextResponse }> {
  if (!stripe) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Payments unavailable" }, { status: 503 }),
    }
  }

  const secret = readStripeWebhookSecret()
  if (!secret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET missing or not a whsec_ secret")
    return {
      ok: false,
      response: NextResponse.json({ error: "Webhook not configured" }, { status: 503 }),
    }
  }

  const signature = request.headers.get("stripe-signature")?.trim()
  if (!signature) {
    return { ok: false, response: failedSignatureResponse(request, 400, "Missing signature") }
  }

  const body = await request.text()
  if (!body) {
    return { ok: false, response: failedSignatureResponse(request, 400, "Empty payload") }
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch {
    return { ok: false, response: failedSignatureResponse(request, 400, "Invalid signature") }
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY ?? "")
  if (!stripeEventLivemodeAllowed(event.livemode, secretKey)) {
    console.error("[Webhook] Rejected livemode mismatch", {
      type: event.type,
      livemode: event.livemode,
    })
    return { ok: false, response: failedSignatureResponse(request, 400, "Invalid signature") }
  }

  return { ok: true, event }
}

export function isProcessableStripeEvent(type: string): boolean {
  return STRIPE_WEBHOOK_ALLOWED_EVENTS.has(type)
}
