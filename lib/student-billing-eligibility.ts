import type { BillingCadence } from "@/lib/membership-constants"

/**
 * Course roster students (non–platform-guest) are semester-locked for the term.
 * Platform guests / self-service accounts may choose monthly or semester.
 */
export function isSemesterOnlyBillingStudent(
  isPlatformGuest: boolean | null | undefined,
): boolean {
  return !Boolean(isPlatformGuest)
}

export function resolveStudentBillingCadence(
  tierId: string,
  requested: BillingCadence | null | undefined,
  semesterOnly: boolean,
): BillingCadence {
  if (tierId === "Scholar") return "monthly"
  if (semesterOnly) return "semester"
  if (requested === "semester" || requested === "monthly") return requested
  return tierId === "Trailblazer" ? "semester" : "monthly"
}

export function availableBillingCadences(
  semesterOnly: boolean,
): BillingCadence[] {
  return semesterOnly ? ["semester"] : ["monthly", "semester"]
}
