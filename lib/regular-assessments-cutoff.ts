/**
 * Semester conclusion cutoff for regular coursework (quizzes and homework).
 *
 * Precedence:
 * 1. **Primary** — each assessment's own `available_from` / `available_until` window.
 * 2. **Secondary** — when the active academic term ends, remaining quiz/homework access closes.
 *
 * Mid-semester and final exams are excluded — they follow per-exam schedules and allowlists.
 *
 * Client-safe sync helpers live here. Server access gating must use
 * `@/lib/regular-assessments-cutoff-server` (reads `academic_terms.end_date`).
 */

/** Fallback when no active academic term is configured. */
export const DEFAULT_REGULAR_ASSESSMENTS_HARD_CLOSE_AT = new Date("2026-07-31T23:59:59.999-05:00")

export const REGULAR_ASSESSMENTS_DEADLINE_LABEL =
  typeof process.env.REGULAR_ASSESSMENTS_DEADLINE_LABEL === "string" &&
  process.env.REGULAR_ASSESSMENTS_DEADLINE_LABEL.trim() !== ""
    ? process.env.REGULAR_ASSESSMENTS_DEADLINE_LABEL.trim()
    : "Friday, July 31, 2026, 11:59 p.m. Central Time (CDT)"

/** @deprecated Prefer getRegularAssessmentsHardCloseAt() from regular-assessments-cutoff-server. */
export const REGULAR_ASSESSMENTS_HARD_CLOSE_AT = DEFAULT_REGULAR_ASSESSMENTS_HARD_CLOSE_AT

function parseEnvHardCloseIso(): Date | null {
  const raw = process.env.REGULAR_ASSESSMENTS_HARD_CLOSE_ISO
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

/**
 * Sync check for client-only UI (banner). Uses code default — not used for access gating.
 * Access decisions must use isPastRegularAssessmentsHardCloseAsync() on the server.
 */
export function isPastRegularAssessmentsHardClose(at: Date = new Date()): boolean {
  const fromEnv = parseEnvHardCloseIso()
  const closeAt = fromEnv ?? DEFAULT_REGULAR_ASSESSMENTS_HARD_CLOSE_AT
  return at.getTime() > closeAt.getTime()
}

/** Alias for readability at call sites. */
export function isSemesterConcluded(at: Date = new Date()): boolean {
  return isPastRegularAssessmentsHardClose(at)
}

/** DB `quizzes.assessment_type` values that close at semester end (not mid-semester or finals). */
export function isRegularAssessmentTypeForSemesterCutoff(dbType: string | null | undefined): boolean {
  const n = String(dbType ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  if (!n) return false
  if (n === "quiz" || n === "homework") return true
  return false
}

/** Primary: per-assessment calendar due has passed. */
export function isPastAssessmentIndividualDeadline(
  availableUntil: Date | string | null | undefined,
  at: Date = new Date(),
): boolean {
  if (!availableUntil) return false
  return new Date(availableUntil).getTime() < at.getTime()
}

export function regularAssessmentsClosedMessage(): string {
  return `The semester concluded on ${REGULAR_ASSESSMENTS_DEADLINE_LABEL}. Course quizzes and homework are now closed. Mid-semester and final exams follow your instructor’s separate schedule. Contact your instructor if you have an emergency.`
}
