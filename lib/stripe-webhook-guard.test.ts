/**
 * Run: npx tsx --test lib/stripe-webhook-guard.test.ts lib/stripe-payment-guards.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isProcessableStripeEvent,
  readStripeWebhookSecret,
  stripeEventLivemodeAllowed,
} from "@/lib/stripe-webhook-guard"

describe("Stripe webhook secret", () => {
  it("rejects missing or non-whsec secrets", () => {
    assert.equal(readStripeWebhookSecret({} as NodeJS.ProcessEnv), null)
    assert.equal(readStripeWebhookSecret({ STRIPE_WEBHOOK_SECRET: "sk_live_abc" } as NodeJS.ProcessEnv), null)
    assert.equal(readStripeWebhookSecret({ STRIPE_WEBHOOK_SECRET: "  " } as NodeJS.ProcessEnv), null)
  })

  it("accepts a Stripe webhook signing secret", () => {
    assert.equal(
      readStripeWebhookSecret({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" } as NodeJS.ProcessEnv),
      "whsec_test_secret",
    )
  })
})

describe("Stripe webhook livemode", () => {
  it("requires live events with a live secret key", () => {
    assert.equal(stripeEventLivemodeAllowed(true, "sk_live_abc"), true)
    assert.equal(stripeEventLivemodeAllowed(false, "sk_live_abc"), false)
  })

  it("requires test events with a test secret key", () => {
    assert.equal(stripeEventLivemodeAllowed(false, "sk_test_abc"), true)
    assert.equal(stripeEventLivemodeAllowed(true, "sk_test_abc"), false)
  })

  it("fails closed when the secret key is missing", () => {
    assert.equal(stripeEventLivemodeAllowed(true, ""), false)
    assert.equal(stripeEventLivemodeAllowed(false, "rk_live_abc"), false)
  })
})

describe("Stripe webhook event allowlist", () => {
  it("does not process arbitrary event types", () => {
    assert.equal(isProcessableStripeEvent("checkout.session.completed"), true)
    assert.equal(isProcessableStripeEvent("customer.updated"), false)
    assert.equal(isProcessableStripeEvent("charge.succeeded"), false)
  })
})
