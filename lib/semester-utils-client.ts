/**
 * Client-safe semester utilities
 * These functions don't use the database and are safe to use in client components
 */

import { SEMESTER_END_DATE, MONTHS_IN_SEMESTER, computeDefaultSemesterStartDate, type MembershipPlan } from "./membership-constants"

/**
 * Calculate savings for semester plan vs monthly
 * Client-safe version (no database access)
 */
export function calculateSemesterSavings(plan: MembershipPlan): {
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

  const monthlyTotal = (plan.monthlyPriceInCents / 100) * MONTHS_IN_SEMESTER
  const semesterPrice = plan.semesterPriceInCents / 100
  const savings = monthlyTotal - semesterPrice
  const savingsPercentage = (savings / monthlyTotal) * 100

  return {
    monthlyTotal,
    semesterPrice,
    savings,
    savingsPercentage
  }
}

/**
 * Check if a date has passed (membership expired)
 * Client-safe version
 */
export function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false
  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return expiryDate < new Date()
}

/**
 * Format semester end date for display (client-safe, uses default)
 */
export function formatSemesterEndDateClient(): string {
  const date = new Date(SEMESTER_END_DATE)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatSemesterStartDateClient(): string {
  const date = computeDefaultSemesterStartDate()
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
