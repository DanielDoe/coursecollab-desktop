import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAuthorizedStudentMembershipCharge,
  isPaidCheckoutSession,
  isPaidMembershipTier,
  isSucceededPaymentIntent,
} from "@/lib/stripe-payment-guards"

describe("Paid checkout gate", () => {
  it("only fulfills paid checkout sessions", () => {
    assert.equal(isPaidCheckoutSession({ payment_status: "paid" }), true)
    assert.equal(isPaidCheckoutSession({ payment_status: "unpaid" }), false)
    assert.equal(isPaidCheckoutSession({ payment_status: "no_payment_required" }), false)
    assert.equal(isPaidCheckoutSession({}), false)
  })

  it("only fulfills succeeded payment intents", () => {
    assert.equal(isSucceededPaymentIntent({ status: "succeeded" }), true)
    assert.equal(isSucceededPaymentIntent({ status: "requires_payment_method" }), false)
  })
})

describe("Student membership charge catalog", () => {
  it("rejects Scholar, missing amount, and $0 charges", () => {
    assert.equal(isPaidMembershipTier("Scholar"), false)
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "semester", 0), false)
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "semester", null), false)
    assert.equal(isAuthorizedStudentMembershipCharge("Trailblazer", undefined, 3999), false)
  })

  it("accepts current sale, list, and legacy semester amounts", () => {
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "semester", 1999), true)
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "semester", 2999), true)
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "semester", 2499), true)
    assert.equal(isAuthorizedStudentMembershipCharge("Trailblazer", "semester", 3999), true)
    assert.equal(isAuthorizedStudentMembershipCharge("Trailblazer", "semester", 4999), true)
  })

  it("rejects underpaid or unknown amounts", () => {
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "semester", 1), false)
    assert.equal(isAuthorizedStudentMembershipCharge("Trailblazer", "semester", 1999), false)
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "monthly", 1999), false)
    assert.equal(isAuthorizedStudentMembershipCharge("Explorer", "monthly", 599), true)
    assert.equal(isAuthorizedStudentMembershipCharge("Trailblazer", "monthly", 999), true)
  })
})
