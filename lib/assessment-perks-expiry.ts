/**
 * Membership rollover and tier retakes stay available until N days after
 * the assessment `available_until` deadline, then expire for grade finalization.
 *
 * Platform default: ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE (7).
 * Per course: course_policies.grading_policy.assessment_perks_grace_days_after_deadline
 */

export const DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE = 7

/** Platform-wide fallback when a course has no override. */
export function getPlatformDefaultAssessmentPerksGraceDays(): number {
  const raw = process.env.ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE
  const n = raw != null && raw !== "" ? parseInt(String(raw), 10) : DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE
  return Math.min(n, 90)
}

/** @deprecated Prefer course policy via getCourseAssessmentPerksGraceDaysAfterDeadline */
export function getAssessmentPerksGraceDaysAfterDeadline(): number {
  return getPlatformDefaultAssessmentPerksGraceDays()
}

export function parseAssessmentPerksGraceDays(raw: unknown): number {
  if (raw == null || raw === "") return getPlatformDefaultAssessmentPerksGraceDays()
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0) return getPlatformDefaultAssessmentPerksGraceDays()
  return Math.min(n, 90)
}

/** Last instant rollover / membership retakes remain valid (deadline + grace days). */
export function getAssessmentPerksExpiry(
  availableUntil: Date | string | null | undefined,
  graceDays: number = getPlatformDefaultAssessmentPerksGraceDays(),
): Date | null {
  if (availableUntil == null) return null
  const deadline = new Date(availableUntil)
  if (Number.isNaN(deadline.getTime())) return null
  return new Date(deadline.getTime() + graceDays * 24 * 60 * 60 * 1000)
}

export function isPastAssessmentPerksExpiry(
  availableUntil: Date | string | null | undefined,
  at: Date = new Date(),
  graceDays: number = getPlatformDefaultAssessmentPerksGraceDays(),
): boolean {
  const expiry = getAssessmentPerksExpiry(availableUntil, graceDays)
  if (!expiry) return false
  return at.getTime() > expiry.getTime()
}

export function assessmentPerksExpiredMessage(
  graceDays: number = getPlatformDefaultAssessmentPerksGraceDays(),
): string {
  return `Rollover and membership retakes are no longer available — the ${graceDays}-day grace period after the deadline has ended. Contact your instructor if you need help.`
}

export function assessmentPerksExpiryIso(
  availableUntil: Date | string | null | undefined,
  graceDays: number = getPlatformDefaultAssessmentPerksGraceDays(),
): string | null {
  return getAssessmentPerksExpiry(availableUntil, graceDays)?.toISOString() ?? null
}
