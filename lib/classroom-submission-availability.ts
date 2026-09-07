/**
 * Shared availability helpers for classroom point assignments.
 * Server queries use due_at when set; otherwise duration_hours + 72h grace from created_at.
 */

export function dueAtToDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function datetimeLocalToDueAtIso(local: string): string | null {
  const trimmed = local.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** June 16, 2026 11:59:59 PM Central (CDT) — passed Ch.3 circuit submissions (E3-1, E3-3) */
export const ECE2202_E3_PASSED_DUE_CT = new Date("2026-06-16T23:59:59-05:00")

/** @deprecated Use ECE2202_E3_PASSED_DUE_CT */
export const ECE2202_E3_1_DUE_CT = ECE2202_E3_PASSED_DUE_CT

/** June 17, 2026 11:59:59 PM Central (CDT) — Ch.3 in-class circuit submissions */
export const ECE2202_CH3_INCLASS_JUNE17_DUE_CT = new Date("2026-06-17T23:59:59-05:00")

/** June 22, 2026 11:59:59 PM Central (CDT) — Ch.3 Thévenin / Norton / June 18 handout (extended from Sun Jun 21) */
export const ECE2202_CH3_INCLASS_JUNE18_DUE_CT = new Date("2026-06-22T23:59:59-05:00")

/** Monday June 29, 2026 11:59:59 PM Central (CDT) — Ch.4 op-amp circuit classroom submissions (extended from Sun Jun 28) */
export const ECE2202_CH4_OPAMP_CIRCUIT_DUE_CT = new Date("2026-06-29T23:59:59-05:00")

/** Previous Ch.4 op-amp deadline (Sun Jun 28) — for audit / backfill reference. */
export const ECE2202_CH4_OPAMP_JUNE28_DUE_CT = new Date("2026-06-28T23:59:59-05:00")

/** Sunday July 5, 2026 11:59:59 PM Central (CDT) — previous Lecture 5 workspace deadline (extended to Jul 6, then Jul 8). */
export const ECE2202_LECTURE5_WORKSPACE_JULY5_DUE_CT = new Date("2026-07-05T23:59:59-05:00")

/** Monday July 6, 2026 11:59:59 PM Central (CDT) — previous Lecture 5 workspace extension (extended to Jul 8). */
export const ECE2202_LECTURE5_WORKSPACE_JULY6_DUE_CT = new Date("2026-07-06T23:59:59-05:00")

/** Tuesday July 8, 2026 11:59:59 PM Central (CDT) — Lecture 5 workspace (Ch.5 RC & RL) classroom submissions */
export const ECE2202_LECTURE5_WORKSPACE_DUE_CT = new Date("2026-07-08T23:59:59-05:00")

/** Tuesday July 15, 2026 11:59:59 PM Central (CDT) — Lecture 6 (Ch.6 switching RLC) classroom submissions */
export const ECE2202_LECTURE6_CLASSROOM_DUE_CT = new Date("2026-07-15T23:59:59-05:00")

/** Thursday July 23, 2026 11:59:59 PM Central (CDT) — Lecture 7 (Ch.7 AC Analysis) classroom submissions */
export const ECE2202_LECTURE7_CLASSROOM_DUE_CT = new Date("2026-07-23T23:59:59-05:00")

/** Thursday July 30, 2026 11:59:59 PM Central (CDT) — Lecture 8 (Ch.8 AC Power) classroom submissions */
export const ECE2202_LECTURE8_CLASSROOM_DUE_CT = new Date("2026-07-30T23:59:59-05:00")

/** Active Classroom Points assignment ids for Lecture 7 / CAD Ch.7 (§-prefixed titles). */
export const ECE2202_LECTURE7_CLASSROOM_SUBMISSION_ID_MIN = 139
export const ECE2202_LECTURE7_CLASSROOM_SUBMISSION_ID_MAX = 155

export function isEce2202Lecture7ClassroomSubmission(
  submissionId: number | null | undefined,
): boolean {
  const id = Number(submissionId)
  return (
    Number.isFinite(id) &&
    id >= ECE2202_LECTURE7_CLASSROOM_SUBMISSION_ID_MIN &&
    id <= ECE2202_LECTURE7_CLASSROOM_SUBMISSION_ID_MAX
  )
}

/** Wednesday July 1, 2026 11:59:59 PM Central (CDT) — in-class deadline for Lecture 5 (extended to Jul 5). */
export const ECE2202_LECTURE5_INCLASS_JULY1_DUE_CT = new Date("2026-07-01T23:59:59-05:00")

/** @deprecated Use ECE2202_LECTURE5_INCLASS_JULY1_DUE_CT */
export const ECE2202_LECTURE5_INCLASS_JUNE30_DUE_CT = ECE2202_LECTURE5_INCLASS_JULY1_DUE_CT

/** Previous Ch.4 op-amp deadline (Wed Jun 25) — for audit / backfill reference. */
export const ECE2202_CH4_OPAMP_JUNE25_DUE_CT = new Date("2026-06-25T23:59:59-05:00")

/** Previous extension deadline (Sun Jun 21) — for audit / backfill reference. */
export const ECE2202_CH3_INCLASS_JUNE21_DUE_CT = new Date("2026-06-21T23:59:59-05:00")

/** Original June 18, 2026 deadline (before extension) — for timing-booster backfill at submit time. */
export const ECE2202_CH3_INCLASS_ORIGINAL_JUNE18_DUE_CT = new Date("2026-06-18T23:59:59-05:00")

/** @deprecated Use ECE2202_CH3_INCLASS_JUNE17_DUE_CT */
export const ECE2202_E3_TWO_SUPERNODES_DUE_CT = ECE2202_CH3_INCLASS_JUNE17_DUE_CT

export function formatAssignmentDueLabel(
  dueAt: string | Date | null | undefined,
  expiresAt?: string | Date | null,
): string | null {
  if (dueAt) {
    return new Date(dueAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }
  if (expiresAt) {
    return new Date(expiresAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }
  return null
}

export function assignmentNeverExpires(row: {
  due_at?: string | Date | null
  duration_hours?: number | null
}): boolean {
  return row.due_at == null && (row.duration_hours == null || row.duration_hours === undefined)
}

/** Original due date for timing boosters when an assignment was extended (submission window uses due_at). */
export function originalDueForTimingBooster(submissionId: number | null | undefined): Date | null {
  if (submissionId == null) return null
  const id = Number(submissionId)
  if (!Number.isFinite(id)) return null
  if (id === 68 || id === 69) return ECE2202_E3_PASSED_DUE_CT
  if (id >= 70 && id <= 72) return ECE2202_CH3_INCLASS_JUNE17_DUE_CT
  if (id >= 73 && id <= 77) return ECE2202_CH3_INCLASS_ORIGINAL_JUNE18_DUE_CT
  if (id >= 80 && id <= 89) return ECE2202_CH4_OPAMP_JUNE25_DUE_CT
  if (id >= 90 && id <= 102) return ECE2202_LECTURE5_INCLASS_JULY1_DUE_CT
  // Lecture 7 uses a flat on-time x3 (see resolveClassroomSubmissionBooster); keep due for reference.
  if (isEce2202Lecture7ClassroomSubmission(id)) return ECE2202_LECTURE7_CLASSROOM_DUE_CT
  return null
}
