/** @deprecated Import from cora-credit-ledger.ts */
export {
  ensureGuestCreditLedgerSchema as ensureGuestCoraCreditsSchema,
  getGuestCoraBalance,
  grantGuestCredits,
  deductGuestCoraCredits,
  reserveGuestCoraCredits,
  releaseGuestCoraReservation,
  type GuestCoraBalance,
} from "@/lib/guest/cora-credit-ledger"

export async function grantGuestIncludedCredits(studentId: number, plan: import("@/lib/guest/types").GuestPlan): Promise<void> {
  const { getGuestAccessPlan } = await import("@/lib/guest/membership-config")
  const { grantGuestCredits } = await import("@/lib/guest/cora-credit-ledger")
  const cfg = getGuestAccessPlan(plan)
  const type = plan === "cora_career" ? "LIFETIME_PURCHASE_GRANT" : "STARTER_GRANT"
  await grantGuestCredits(studentId, type, cfg.coraCreditsIncluded, {
    source: plan,
    sourceReference: cfg.displayName,
  })
}

export async function addGuestPurchasedCredits(studentId: number, credits: number, ref?: string): Promise<void> {
  const { grantGuestCredits } = await import("@/lib/guest/cora-credit-ledger")
  await grantGuestCredits(studentId, "CREDIT_PACK_PURCHASE", credits, {
    source: "credit_pack",
    sourceReference: ref ?? "pack",
  })
}
