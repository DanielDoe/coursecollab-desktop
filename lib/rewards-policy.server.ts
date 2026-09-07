import { sql } from "@/lib/db"
import { parseRewardsPolicy, type RewardsPolicy } from "@/lib/course-policy-settings"

export async function getRewardsPolicyForCourse(courseId: number | null | undefined): Promise<RewardsPolicy> {
  if (courseId == null || !Number.isFinite(courseId)) {
    return parseRewardsPolicy(null)
  }

  const rows = await sql`
    SELECT rewards_policy
    FROM course_policies
    WHERE course_id = ${courseId}
    LIMIT 1
  `

  return parseRewardsPolicy(rows[0]?.rewards_policy)
}

export async function getRewardsPolicyForStudent(studentDbId: number): Promise<RewardsPolicy> {
  const rows = await sql`
    SELECT course_id FROM students WHERE id = ${studentDbId} LIMIT 1
  `
  const courseId = rows[0]?.course_id != null ? Number(rows[0].course_id) : null
  return getRewardsPolicyForCourse(courseId)
}

export async function getStudentApprovedPointsToday(studentDbId: number): Promise<number> {
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(points), 0)::float AS total
      FROM classroom_points
      WHERE student_id = ${studentDbId}
        AND status = 'approved'
        AND COALESCE(awarded_at, created_at) >= CURRENT_DATE
    `
    return Number(rows[0]?.total ?? 0)
  } catch {
    return 0
  }
}
