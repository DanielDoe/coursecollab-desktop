import { sql } from "@/lib/db"
import {
  DEFAULT_ASSESSMENT_POLICY,
  mergeAssessmentPolicy,
  parseAssessmentPolicy,
  type AssessmentPolicy,
} from "@/lib/assessment-policy-settings"
import {
  parseAssessmentPlatformAccess,
  type AssessmentPlatformAccess,
} from "@/lib/assessment-platform-access"

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

export async function saveAssessmentPlatformAccessForCourse(
  courseId: number,
  instructorId: number,
  platformAccess: AssessmentPlatformAccess,
): Promise<AssessmentPolicy> {
  await ensureAssessmentPolicyColumn()
  await sql`
    INSERT INTO course_policies (course_id, updated_by)
    VALUES (${courseId}, ${instructorId})
    ON CONFLICT (course_id) DO NOTHING
  `
  const existing = await getAssessmentPolicyForCourse(courseId)
  const next = mergeAssessmentPolicy(existing, {
    access: {
      ...existing.access,
      platform_access: parseAssessmentPlatformAccess(platformAccess),
    },
  })
  await sql`
    UPDATE course_policies
    SET assessment_policy = ${JSON.stringify(next)}::jsonb,
        updated_by = ${instructorId},
        updated_at = NOW()
    WHERE course_id = ${courseId}
  `
  return next
}
