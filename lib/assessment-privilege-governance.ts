/**
 * Server-side assessment governance (database access).
 * Client components must import from assessment-privilege-governance-shared.ts.
 */

import { sql } from "@/lib/db"
import {
  DEFAULT_ASSESSMENT_PRIVILEGE_SOURCE,
  parseAssessmentPrivilegeSource,
  membershipAssessmentBenefitsAllowed,
  tradeCenterAssessmentBenefitsAllowed,
  courseAssessmentPerksSummary,
  type AssessmentPrivilegeSource,
  type CourseAssessmentGovernance,
} from "@/lib/assessment-privilege-governance-shared"

export {
  ASSESSMENT_PRIVILEGE_SOURCES,
  DEFAULT_ASSESSMENT_PRIVILEGE_SOURCE,
  parseAssessmentPrivilegeSource,
  assessmentPrivilegeSourceLabel,
  membershipAssessmentBenefitsAllowed,
  tradeCenterAssessmentBenefitsAllowed,
  courseAssessmentPerksSummary,
  type AssessmentPrivilegeSource,
  type CourseAssessmentGovernance,
} from "@/lib/assessment-privilege-governance-shared"

export async function ensureAssessmentGovernanceColumns(): Promise<void> {
  await sql`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS assessment_privilege_source VARCHAR(32) NOT NULL DEFAULT 'instructor_only'
  `
  await sql`
    ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS show_course_policy_notice BOOLEAN NOT NULL DEFAULT true
  `
}

export async function getCourseAssessmentGovernance(
  courseId: number,
): Promise<CourseAssessmentGovernance> {
  if (!Number.isFinite(courseId) || courseId < 1) {
    return {
      assessment_privilege_source: DEFAULT_ASSESSMENT_PRIVILEGE_SOURCE,
      show_course_policy_notice: true,
    }
  }

  await ensureAssessmentGovernanceColumns()

  const rows = await sql`
    SELECT assessment_privilege_source, show_course_policy_notice
    FROM courses
    WHERE id = ${courseId}
    LIMIT 1
  `

  const row = rows[0] as {
    assessment_privilege_source?: string | null
    show_course_policy_notice?: boolean | null
  } | undefined

  if (!row) {
    return {
      assessment_privilege_source: DEFAULT_ASSESSMENT_PRIVILEGE_SOURCE,
      show_course_policy_notice: true,
    }
  }

  return {
    assessment_privilege_source: parseAssessmentPrivilegeSource(row.assessment_privilege_source),
    show_course_policy_notice: row.show_course_policy_notice !== false,
  }
}

export async function getQuizCourseId(quizId: number): Promise<number | null> {
  const rows = await sql`
    SELECT course_id FROM quizzes WHERE id = ${quizId} AND deleted_at IS NULL LIMIT 1
  `
  const cid = rows[0]?.course_id
  return cid != null ? Number(cid) : null
}

export async function getStudentCourseId(studentId: number): Promise<number | null> {
  if (!Number.isFinite(studentId) || studentId < 1) return null
  const rows = await sql`
    SELECT course_id FROM students WHERE id = ${studentId} AND deleted_at IS NULL LIMIT 1
  `
  const cid = rows[0]?.course_id
  return cid != null ? Number(cid) : null
}

/** Membership-based assessment perks (retakes, save-and-finish, membership rollovers) for a student in their course. */
export async function membershipAssessmentBenefitsAllowedForStudent(
  studentId: number,
  courseId?: number | null,
): Promise<boolean> {
  const cid = courseId ?? (await getStudentCourseId(studentId))
  if (!cid) return false
  const gov = await getCourseAssessmentGovernance(cid)
  return membershipAssessmentBenefitsAllowed(gov.assessment_privilege_source)
}

/** Trade Center assessment redemptions (e.g. points-for-rollover) for a student in their course. */
export async function tradeCenterAssessmentBenefitsAllowedForStudent(
  studentId: number,
  courseId?: number | null,
): Promise<boolean> {
  const cid = courseId ?? (await getStudentCourseId(studentId))
  if (!cid) return false
  const gov = await getCourseAssessmentGovernance(cid)
  return tradeCenterAssessmentBenefitsAllowed(gov.assessment_privilege_source)
}

/** Perks summary for a student’s course (Trade Center + membership lanes). */
export async function getCourseAssessmentPerksForStudent(studentId: number) {
  const courseId = await getStudentCourseId(studentId)
  if (!courseId) {
    return courseAssessmentPerksSummary(DEFAULT_ASSESSMENT_PRIVILEGE_SOURCE)
  }
  const gov = await getCourseAssessmentGovernance(courseId)
  return courseAssessmentPerksSummary(gov.assessment_privilege_source)
}
