import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

export async function publishCourseAssessment(params: {
  instructorId: number
  courseId: number
  quizId: number
}): Promise<{ quizId: number; title: string; href: string }> {
  const quizId = Number(params.quizId)
  if (!Number.isFinite(quizId) || quizId <= 0) {
    throw new Error("quizId is required.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot publish assessments for this course.")

  const rows = (await sql`
    SELECT q.id, q.title, q.created_by
    FROM quizzes q
    WHERE q.id = ${quizId}
    LIMIT 1
  `) as { id: number; title: string; created_by: number | null }[]

  const quiz = rows[0]
  if (!quiz) throw new Error("Assessment not found.")
  if (quiz.created_by != null && Number(quiz.created_by) !== params.instructorId) {
    throw new Error("You can only publish assessments you created.")
  }

  await sql`
    UPDATE quizzes
    SET is_public = true, is_active = true, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${quizId}
  `

  return {
    quizId,
    title: quiz.title,
    href: "/module/quizzes",
  }
}
