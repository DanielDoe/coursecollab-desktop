/**
 * Semester membership utilities (SERVER-SIDE ONLY)
 * Handles semester end dates, expiration checks, and savings calculations
 * 
 * NOTE: This file uses database access and should NOT be imported in client components.
 * Use `semester-utils-client.ts` for client-side utilities.
 */

import {
  SEMESTER_END_DATE,
  MONTHS_IN_SEMESTER,
  computeDefaultSemesterStartDate,
  type MembershipPlan,
} from "./membership-constants"
import {
  formatAcademicTermLabel,
  getActiveAcademicTerm,
  semesterEndDateFromTermEnd,
} from "./active-academic-term"

function monthsBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return MONTHS_IN_SEMESTER
  return Math.max(1, Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000)))
}

function parseTermStart(endDate: string | Date | null | undefined): Date | null {
  if (endDate == null || endDate === "") return null
  const d = endDate instanceof Date ? endDate : new Date(String(endDate))
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * Get the current active semester end date from database
 * Falls back to environment variable or default if no active term found
 */
export async function getSemesterEndDate(): Promise<Date> {
  try {
    const active = await getActiveAcademicTerm()
    const end = semesterEndDateFromTermEnd(active?.end_date ?? null)
    if (end) return end
  } catch (error) {
    console.error("[Semester Utils] Failed to fetch semester end date from database:", error)
  }
  
  return new Date(SEMESTER_END_DATE)
}

/**
 * Get semester start and end dates from database
 */
export async function getSemesterDates(): Promise<{ startDate: Date | null; endDate: Date | null }> {
  try {
    const active = await getActiveAcademicTerm()
    if (active) {
      return {
        startDate: active.start_date ? parseTermStart(active.start_date) : computeDefaultSemesterStartDate(),
        endDate: semesterEndDateFromTermEnd(active.end_date ?? null),
      }
    }
  } catch (error) {
    console.error("[Semester Utils] Failed to fetch semester dates from database:", error)
  }
  
  return { startDate: computeDefaultSemesterStartDate(), endDate: new Date(SEMESTER_END_DATE) }
}

/** Billing months in the active semester (for semester vs monthly savings). */
export async function getMonthsInSemester(): Promise<number> {
  const { startDate, endDate } = await getSemesterDates()
  if (startDate && endDate) return monthsBetween(startDate, endDate)
  return MONTHS_IN_SEMESTER
}

export type SemesterBillingWindow = {
  label: string | null
  startDate: string | null
  endDate: string | null
  monthsInSemester: number
}

export async function getSemesterBillingWindow(): Promise<SemesterBillingWindow> {
  const active = await getActiveAcademicTerm().catch(() => null)
  const { startDate, endDate } = await getSemesterDates()
  const monthsInSemester = startDate && endDate ? monthsBetween(startDate, endDate) : MONTHS_IN_SEMESTER
  return {
    label: active ? formatAcademicTermLabel(active.year, active.term) : null,
    startDate: startDate?.toISOString() ?? null,
    endDate: endDate?.toISOString() ?? null,
    monthsInSemester,
  }
}

/**
 * Check if a date has passed (membership expired)
 */
export function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false
  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return expiryDate < new Date()
}

/**
 * Calculate savings for semester plan vs monthly
 * NOTE: This is duplicated in semester-utils-client.ts for client-side use
 */
export function calculateSemesterSavings(
  plan: MembershipPlan,
  monthsInSemester: number = MONTHS_IN_SEMESTER,
): {
  monthlyTotal: number
  semesterPrice: number
  savings: number
  savingsPercentage: number
} {
  if (!plan.monthlyPriceInCents || !plan.semesterPriceInCents) {
    return {
      monthlyTotal: 0,
      semesterPrice: 0,
      savings: 0,
      savingsPercentage: 0
    }
  }

  const monthlyTotal = (plan.monthlyPriceInCents / 100) * monthsInSemester
  const semesterPrice = plan.semesterPriceInCents / 100
  const savings = monthlyTotal - semesterPrice
  const savingsPercentage = monthlyTotal > 0 ? (savings / monthlyTotal) * 100 : 0

  return {
    monthlyTotal,
    semesterPrice,
    savings,
    savingsPercentage
  }
}

/**
 * Format semester end date for display
 */
export async function formatSemesterEndDate(): Promise<string> {
  const date = await getSemesterEndDate()
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Get days until semester ends
 */
export async function getDaysUntilSemesterEnd(): Promise<number> {
  const now = new Date()
  const endDate = await getSemesterEndDate()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}
