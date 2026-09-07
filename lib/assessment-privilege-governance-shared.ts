/**
 * Client-safe assessment governance types and helpers (no database imports).
 */

export const ASSESSMENT_PRIVILEGE_SOURCES = [
  "instructor_only",
  "membership_enabled",
  "hybrid",
] as const

export type AssessmentPrivilegeSource = (typeof ASSESSMENT_PRIVILEGE_SOURCES)[number]

export const DEFAULT_ASSESSMENT_PRIVILEGE_SOURCE: AssessmentPrivilegeSource = "instructor_only"

export type CourseAssessmentGovernance = {
  assessment_privilege_source: AssessmentPrivilegeSource
  show_course_policy_notice: boolean
}

export function parseAssessmentPrivilegeSource(raw: unknown): AssessmentPrivilegeSource {
  const v = String(raw ?? "").trim().toLowerCase()
  if (v === "membership_enabled" || v === "hybrid") return v
  return "instructor_only"
}

export function assessmentPrivilegeSourceLabel(source: AssessmentPrivilegeSource): string {
  switch (source) {
    case "membership_enabled":
      return "Membership enabled"
    case "hybrid":
      return "Hybrid (instructor + membership + Trade Center)"
    default:
      return "Instructor controlled only"
  }
}

/** Membership-based assessment perks (retakes, rollovers, save-and-finish) allowed for this course? */
export function membershipAssessmentBenefitsAllowed(source: AssessmentPrivilegeSource): boolean {
  return source === "membership_enabled" || source === "hybrid"
}

/** Trade Center may grant assessment-related redemptions (rollovers, extra attempts). */
export function tradeCenterAssessmentBenefitsAllowed(source: AssessmentPrivilegeSource): boolean {
  return source === "hybrid"
}

/** Summary of which platform / Trade Center perk lanes are active for a course. */
export function courseAssessmentPerksSummary(source: AssessmentPrivilegeSource): {
  source: AssessmentPrivilegeSource
  membershipPlatformPerks: boolean
  tradeCenterRedemptions: boolean
  label: string
} {
  return {
    source,
    membershipPlatformPerks: membershipAssessmentBenefitsAllowed(source),
    tradeCenterRedemptions: tradeCenterAssessmentBenefitsAllowed(source),
    label: assessmentPrivilegeSourceLabel(source),
  }
}
