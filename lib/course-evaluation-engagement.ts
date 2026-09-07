import { sql } from "@/lib/db"
import { ensureCourseEvaluationSchema } from "@/lib/ensure-course-evaluation-schema"
import { COURSE_EVALUATION_ENGAGEMENT_CREDITS } from "@/lib/course-evaluation-constants"

export { COURSE_EVALUATION_ENGAGEMENT_CREDITS }

export async function getApprovedCourseEvaluationCredits(
  studentId: number,
  session?: string,
): Promise<number> {
  await ensureCourseEvaluationSchema()
  const sessionTrim = (session || "ALL").trim() || "ALL"

  const rows = await sql`
    SELECT id FROM course_evaluations
    WHERE student_id = ${studentId}
      AND status = 'approved'
      AND (session = ${sessionTrim} OR ${sessionTrim} = 'ALL')
    LIMIT 1
  `

  return rows.length > 0 ? COURSE_EVALUATION_ENGAGEMENT_CREDITS : 0
}

export async function isCourseEvaluationApproved(
  studentId: number,
  session?: string,
): Promise<boolean> {
  const credits = await getApprovedCourseEvaluationCredits(studentId, session)
  return credits > 0
}
