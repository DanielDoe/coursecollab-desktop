/** Deep-link return URLs for native mobile Stripe hosted checkout. */
export const MOBILE_MEMBERSHIP_SCHEME = "coursecollab"

export function mobileStudentMembershipReturnUrls(tier: string, cadence: string) {
  return {
    success_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(tier)}`,
    cancel_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership/cancel?plan=${encodeURIComponent(tier)}&cadence=${encodeURIComponent(cadence)}`,
  }
}

export function mobileInstructorMembershipReturnUrls(tier: string, cadence: string) {
  return {
    success_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership/success?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(tier)}`,
    cancel_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership/cancel?plan=${encodeURIComponent(tier)}&cadence=${encodeURIComponent(cadence)}`,
  }
}

export function mobileStudentCoraPackReturnUrls() {
  return {
    success_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership?cora_pack=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership?cora_pack=cancel`,
  }
}

export function mobileInstructorCoraPackReturnUrls() {
  return {
    success_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership?cora_pack=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${MOBILE_MEMBERSHIP_SCHEME}://membership?cora_pack=cancel`,
  }
}
