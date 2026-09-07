import { sql } from "@/lib/db"
import { getCourseAssessmentPerksGraceDaysAfterDeadline } from "@/lib/course-grading-policy-settings"
import { getPlatformDefaultAssessmentPerksGraceDays } from "@/lib/assessment-perks-expiry"

export async function getAssessmentPerksGraceDaysForCourse(
  courseId: number | null | undefined,
): Promise<number> {
  if (!courseId || courseId < 1) return getPlatformDefaultAssessmentPerksGraceDays()
  const rows = await sql`
    SELECT grading_policy FROM course_policies WHERE course_id = ${courseId} LIMIT 1
  `
  if (rows.length === 0) return getPlatformDefaultAssessmentPerksGraceDays()
  return getCourseAssessmentPerksGraceDaysAfterDeadline(rows[0]?.grading_policy)
}

export async function getAssessmentPerksGraceDaysForQuiz(quizId: number): Promise<number> {
  if (!quizId || quizId < 1) return getPlatformDefaultAssessmentPerksGraceDays()
  const rows = await sql`
    SELECT cp.grading_policy
    FROM quizzes q
    LEFT JOIN course_policies cp ON cp.course_id = q.course_id
    WHERE q.id = ${quizId} AND q.deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) return getPlatformDefaultAssessmentPerksGraceDays()
  return getCourseAssessmentPerksGraceDaysAfterDeadline(rows[0]?.grading_policy)
}
