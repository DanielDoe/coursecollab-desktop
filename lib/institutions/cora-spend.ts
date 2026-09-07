/**
 * Institution Cora cover is a capped campus pool — never unlimited tokens.
 * The number a student sees is their personal monthly remaining, capped by
 * the institution pool when that pool is configured with a positive allowance.
 */

export type InstitutionCoraPoolSnapshot = {
  included: number
  used: number
  remaining: number
}

/** True only when the institution allowance row was actually decremented. */
export function institutionDebitApplied(updatedRowCount: number): boolean {
  return Number.isFinite(updatedRowCount) && updatedRowCount > 0
}

/**
 * Spendable credits for a covered user.
 * Personal monthly cap always applies. A configured institution pool
 * (included > 0) is an additional hard cap — not a reason to skip metering.
 */
export function studentSpendableCredits(
  personalAvailable: number,
  pool: InstitutionCoraPoolSnapshot | null | undefined,
): number {
  const personal = Math.max(0, Number.isFinite(personalAvailable) ? personalAvailable : 0)
  if (!pool || !Number.isFinite(pool.included) || pool.included <= 0) return personal
  const remaining = Math.max(0, Number.isFinite(pool.remaining) ? pool.remaining : 0)
  return Math.min(personal, remaining)
}

/** Institution debit is campus accounting. It must not replace personal deduct. */
export function shouldSkipPersonalCoraDeduct(_institutionPaid: boolean): boolean {
  return false
}
