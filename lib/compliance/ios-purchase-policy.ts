/**
 * iOS App Store payment compliance policy.
 *
 * Digital memberships and Cora credits are not sold via native Stripe Payment Sheet on iOS
 * until StoreKit is implemented. Entitlements are always granted server-side after verified
 * purchase (Stripe web checkout or future Apple IAP).
 */

export const IOS_PURCHASE_POLICY = {
  nativeDigitalCheckoutAllowed: false,
  restorePurchasesRequired: false,
  entitlementSource: "server" as const,
  paymentProviders: ["stripe_web", "institutional"] as const,
  summary:
    "The iOS app does not sell digital memberships or Cora credits with an external payment link inside the app. Users upgrade on the CourseCollab website; access syncs from server entitlements.",
  webMembershipPaths: {
    student: "/student/dashboard-v2/membership",
    faculty: "/instructor/dashboard-v2/membership",
    guest: "/guest/cora-credits",
  },
} as const

export type IosPurchasePolicySnapshot = typeof IOS_PURCHASE_POLICY
