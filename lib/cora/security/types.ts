/**
 * Cora RBAC security model.
 *
 * Principle: Cora never has more permissions than the invoking authenticated user.
 * There is no privileged "AI user" — only Student / Faculty / Admin scopes.
 */

import type { MembershipTier } from "@/lib/membership-constants"
import type { CoraAgentRole } from "@/lib/cora/roles"

/** Canonical product roles (mobile/web parity). */
export type CoraPrincipalRole = "student" | "faculty" | "admin"

export type CoraPermissionClaim =
  | "read_own_profile"
  | "read_own_grades"
  | "read_own_attendance"
  | "read_own_classroom_points"
  | "read_own_assessments"
  | "read_own_calendar"
  | "read_own_notes"
  | "read_own_flashcards"
  | "read_own_lectures"
  | "read_own_notifications"
  | "search_enrolled_platform"
  | "search_released_lectures"
  | "create_own_flashcards"
  | "create_own_notes"
  | "create_own_practice"
  | "create_own_study_plan"
  | "create_own_calendar"
  | "review_own_released_attempts"
  | "read_assessment_integrity"
  | "learn_concepts"
  | "solve_steps"
  | "code_assist"
  | "circuit_assist"
  | "read_assigned_course"
  | "read_assigned_students"
  | "read_course_analytics"
  | "generate_questions"
  | "build_quizzes"
  | "create_course_flashcards"
  | "publish_course_announcements"
  | "create_question_bank"
  | "grade_assistance"
  | "read_institution_analytics"
  | "read_revenue_analytics"
  | "platform_configuration"
  | "security_center"
  | "ai_governance"
  | "executive_reports"

export type CoraSession = {
  /** Correlation id for this AI turn */
  requestId: string
  role: CoraPrincipalRole
  /** Legacy agent role alias used by tool registries */
  agentRole: CoraAgentRole
  userId: number
  institutionId: number | null
  courseIds: number[]
  sectionIds: number[]
  membershipTier: MembershipTier | string | null
  /** Faculty membership when role is faculty (Free | Pro | Teams) */
  instructorMembershipTier?: string | null
  permissions: ReadonlySet<CoraPermissionClaim>
  /** Product display name */
  productName: string
  claims: {
    studentDbId?: number
    instructorId?: number
    adminId?: number
    courseCode?: string | null
    courseTitle?: string | null
  }
}

export type CoraToolAuthorization =
  | { ok: true }
  | { ok: false; reason: string; code: "role" | "permission" | "scope" | "membership" }
