/**
 * Server-only semester cutoff — reads active academic term end_date from the database.
 * Do not import this from client components.
 */

import {
  formatAcademicTermLabel,
  getActiveAcademicTerm,
  semesterEndDateFromTermEnd,
} from "@/lib/active-academic-term"
import {
  DEFAULT_REGULAR_ASSESSMENTS_HARD_CLOSE_AT,
  REGULAR_ASSESSMENTS_DEADLINE_LABEL,
} from "@/lib/regular-assessments-cutoff"

const RESOLVE_CACHE_MS = 60_000
let resolvedCloseCache: { at: number; value: Date } | null = null

function parseEnvHardCloseIso(): Date | null {
  const raw = process.env.REGULAR_ASSESSMENTS_HARD_CLOSE_ISO
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

/** Resolve semester hard-close instant — active term end_date first, then env, then default. */
export async function getRegularAssessmentsHardCloseAt(): Promise<Date> {
  if (resolvedCloseCache && Date.now() - resolvedCloseCache.at < RESOLVE_CACHE_MS) {
    return resolvedCloseCache.value
  }

  const active = await getActiveAcademicTerm()
  const fromTerm = semesterEndDateFromTermEnd(active?.end_date ?? null)
  if (fromTerm) {
    resolvedCloseCache = { at: Date.now(), value: fromTerm }
    return fromTerm
  }

  const fromEnv = parseEnvHardCloseIso()
  const value = fromEnv ?? DEFAULT_REGULAR_ASSESSMENTS_HARD_CLOSE_AT
  resolvedCloseCache = { at: Date.now(), value }
  return value
}

/** Server-side semester gate — uses active academic term from the database. */
export async function isPastRegularAssessmentsHardCloseAsync(at: Date = new Date()): Promise<boolean> {
  const closeAt = await getRegularAssessmentsHardCloseAt()
  return at.getTime() > closeAt.getTime()
}

export async function isSemesterConcludedAsync(at: Date = new Date()): Promise<boolean> {
  return isPastRegularAssessmentsHardCloseAsync(at)
}

export async function isRegularAssessmentClosedBySemesterConclusion(
  dbType: string | null | undefined,
  at: Date = new Date(),
): Promise<boolean> {
  const { isRegularAssessmentTypeForSemesterCutoff } = await import("@/lib/regular-assessments-cutoff")
  return isRegularAssessmentTypeForSemesterCutoff(dbType) && (await isPastRegularAssessmentsHardCloseAsync(at))
}

export function invalidateRegularAssessmentsHardCloseCache(): void {
  resolvedCloseCache = null
}

export async function getRegularAssessmentsDeadlineLabel(): Promise<string> {
  const active = await getActiveAcademicTerm()
  if (active?.end_date) {
    return `${formatAcademicTermLabel(active.year, active.term)} term end`
  }
  return REGULAR_ASSESSMENTS_DEADLINE_LABEL
}
