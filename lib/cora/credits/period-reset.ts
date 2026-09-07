/**
 * Included Cora credits refill only when the billing period actually changes.
 * Tier flaps (Scholar ↔ institutional Trailblazer) must never rewrite the pot.
 */

export type CreditPeriodAction = "period_reset" | "stamp_period" | "keep"

export function creditPeriodAction(
  rowPeriod: string | null | undefined,
  currentPeriod: string,
): CreditPeriodAction {
  const row = String(rowPeriod ?? "").trim()
  const current = String(currentPeriod ?? "").trim()
  if (!current) return "keep"
  if (!row) return "stamp_period"
  if (row !== current) return "period_reset"
  return "keep"
}

export function shouldRefillIncludedCredits(
  rowPeriod: string | null | undefined,
  currentPeriod: string,
): boolean {
  return creditPeriodAction(rowPeriod, currentPeriod) === "period_reset"
}

export function shouldPersistMembershipTier(
  rowTier: string | null | undefined,
  requestedTier: string | null | undefined,
): boolean {
  if (requestedTier == null || requestedTier === "") return false
  return String(rowTier ?? "") !== String(requestedTier)
}
