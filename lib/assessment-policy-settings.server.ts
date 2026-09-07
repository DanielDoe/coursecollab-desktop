import { sql } from "@/lib/db"
import {
  DEFAULT_ASSESSMENT_POLICY,
  parseAssessmentPolicy,
  type AssessmentPolicy,
} from "@/lib/assessment-policy-settings"

let columnEnsured = false

export async function ensureAssessmentPolicyColumn(): Promise<void> {
  if (columnEnsured) return
  await sql`
    ALTER TABLE course_policies
    ADD COLUMN IF NOT EXISTS assessment_policy JSONB NOT NULL DEFAULT '{}'::jsonb
  `
  columnEnsured = true
}

export async function getAssessmentPolicyForCourse(
  courseId: number | null | undefined,
): Promise<AssessmentPolicy> {
  if (courseId == null || !Number.isFinite(courseId)) {
    return structuredClone(DEFAULT_ASSESSMENT_POLICY)
  }
  try {
    await ensureAssessmentPolicyColumn()
    const rows = await sql`
      SELECT assessment_policy
      FROM course_policies
      WHERE course_id = ${courseId}
      LIMIT 1
    `
    return parseAssessmentPolicy(rows[0]?.assessment_policy)
  } catch {
    return structuredClone(DEFAULT_ASSESSMENT_POLICY)
  }
}
