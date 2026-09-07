import { stripe } from "@/lib/stripe"

/**
 * Mobile membership checkout methods enabled on the Stripe account.
 *
 * Kept: card (+ Apple/Google Pay wallets), link, cashapp, us_bank_account
 * Removed (redirect / amount friction — stuck “Processing…” on cancel):
 *   klarna, amazon_pay, affirm, afterpay_clearpay
 */
export const MEMBERSHIP_MOBILE_PAYMENT_METHOD_TYPES = [
  "card",
  "link",
  "cashapp",
  "us_bank_account",
] as const

export type MembershipMobilePaymentMethodType =
  (typeof MEMBERSHIP_MOBILE_PAYMENT_METHOD_TYPES)[number]

const ALLOWED = new Set<string>(MEMBERSHIP_MOBILE_PAYMENT_METHOD_TYPES)

/** Types that support PaymentIntent setup_future_usage=off_session for saving. */
export const MEMBERSHIP_SAVEABLE_PAYMENT_METHOD_TYPES = new Set<string>([
  "card",
  "link",
  "cashapp",
  "us_bank_account",
])

/** Delayed settlement — membership unlocks when payment_intent.succeeded fires. */
export const MEMBERSHIP_DELAYED_PAYMENT_METHOD_TYPES = new Set<string>(["us_bank_account"])

/** @deprecated Prefer passing only the selected method type on PaymentIntent create. */
export function membershipMobilePaymentMethodTypesForAmount(_amountCents: number): string[] {
  return [...MEMBERSHIP_MOBILE_PAYMENT_METHOD_TYPES]
}

/** Alias used by guest career mobile checkout routes. */
export const membershipPaymentMethodTypesForAmount = membershipMobilePaymentMethodTypesForAmount

export async function assertMembershipMobilePaymentMethod(
  paymentMethodId: string,
  _amountCents?: number,
): Promise<{ ok: true; type: string } | { ok: false; error: string }> {
  if (!stripe) {
    return { ok: false, error: "Payment processing is not configured." }
  }

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (!ALLOWED.has(paymentMethod.type)) {
      return {
        ok: false,
        error:
          "This payment method isn’t supported for membership checkout. Try Apple Pay, Link, Cash App, a card, or a US bank account.",
      }
    }
    return { ok: true, type: paymentMethod.type }
  } catch (error) {
    console.error("[membership-mobile-payment] payment method lookup failed:", error)
    return { ok: false, error: "Could not verify payment method. Please try again." }
  }
}

/** @deprecated Use assertMembershipMobilePaymentMethod */
export const assertMembershipCardPaymentMethod = assertMembershipMobilePaymentMethod
