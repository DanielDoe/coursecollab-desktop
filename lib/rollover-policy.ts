import { SEMESTER_END_DATE } from "@/lib/membership-constants"

/**
 * Days before SEMESTER_END_DATE when self-service membership Extend (rollover apply) closes.
 * After this instant, students cannot POST /api/student/rollover/apply (instructor grants unchanged).
 * Default 21 (~3 weeks). Override with ROLLOVER_APPLY_CUTOFF_DAYS_BEFORE_SEMESTER_END.
 */
export function getRolloverApplyCutoffDaysBeforeSemesterEnd(): number {
  const raw = process.env.ROLLOVER_APPLY_CUTOFF_DAYS_BEFORE_SEMESTER_END
  const n = raw != null && raw !== "" ? parseInt(String(raw), 10) : 21
  if (!Number.isFinite(n) || n < 0) return 21
  return Math.min(n, 365)
}

/** Last moment (UTC) self-service rollover apply is allowed — end of cutoff day before semester end. */
export function getSelfServiceRolloverApplyDeadline(
  semesterEnd: Date = SEMESTER_END_DATE,
  cutoffDays: number = getRolloverApplyCutoffDaysBeforeSemesterEnd(),
): Date {
  const d = new Date(semesterEnd.getTime())
  d.setUTCDate(d.getUTCDate() - cutoffDays)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

export function getSelfServiceRolloverApplyDeadlineIso(
  semesterEnd: Date = SEMESTER_END_DATE,
): string {
  return getSelfServiceRolloverApplyDeadline(semesterEnd).toISOString()
}

export function isSelfServiceRolloverApplyOpen(
  semesterEnd: Date = SEMESTER_END_DATE,
  cutoffDays: number = getRolloverApplyCutoffDaysBeforeSemesterEnd(),
  at: Date = new Date(),
): boolean {
  return at.getTime() <= getSelfServiceRolloverApplyDeadline(semesterEnd, cutoffDays).getTime()
}

export function getSemesterEndIsoForRolloverPolicy(): string {
  return SEMESTER_END_DATE.toISOString()
}
