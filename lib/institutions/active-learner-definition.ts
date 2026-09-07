/**
 * Institutional Active Learner definition.
 *
 * Capacity is unique active students in the contract measurement period — not
 * total institutional enrollment, not lifetime unique students, and not one
 * seat per course.
 */

export const INSTITUTION_ACTIVE_LEARNER_DEFINITION = {
  id: "unique_active_learner_v1",
  measurementPeriod: "license_contract_dates",
  uniqueIdentity: "normalized_email_else_student_id",
  requireQualifyingActivity: true,
  accountExistenceDoesNotCount: true,
  multiCourseDoesNotMultiplySeats: true,
  qualifyingActivities: [
    "covered_course_access",
    "assessment_submission",
    "practice_hub",
    "cora",
    "codebench",
    "playground",
    "learning_materials",
    "other_meaningful_learning_activity",
  ] as const,
  exclude: ["deleted_users", "test_accounts", "platform_administrators", "never_activated_imported_accounts"] as const,
} as const

export function institutionLearnerIdentityKey(input: { email?: string | null; studentId: number }): string {
  const email = String(input.email ?? "").trim().toLowerCase()
  if (email) return `email:${email}`
  return `student:${input.studentId}`
}

export function isExcludedInstitutionLearner(input: {
  deletedAt?: string | Date | null
  email?: string | null
  lastLogin?: string | Date | null
  username?: string | null
}): boolean {
  if (input.deletedAt) return true
  const email = String(input.email ?? "").trim().toLowerCase()
  const username = String(input.username ?? "").trim().toLowerCase()
  if (email.endsWith("@coursecollab.test") || email.includes("+demo@") || email.startsWith("demo-")) return true
  if (username.startsWith("demo-") || username.endsWith("-demo")) return true
  return false
}
