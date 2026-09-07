import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { statusAfterInstructorSaveLetterText } from "@/lib/recommendation-request-transitions"

export async function saveRecommendationDraftLetter(params: {
  instructorId: number
  courseId: number
  requestId: number
  finalLetterText: string
}): Promise<{ requestId: number; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot edit recommendation letters for this course.")

  const requestId = Number(params.requestId)
  if (!Number.isFinite(requestId) || requestId <= 0) throw new Error("requestId is required.")

  const finalText = String(params.finalLetterText ?? "")

  const rows = sqlRows<{ status: string; student_id: number }>(
    await sql`
      SELECT r.status, r.student_id
      FROM recommendation_requests r
      JOIN sessions sess ON sess.id = r.course_id
      WHERE r.id = ${requestId}
        AND r.instructor_id = ${params.instructorId}
        AND sess.course_id = ${params.courseId}
      LIMIT 1
    `,
  )

  if (rows.length === 0) {
    throw new Error("Recommendation request not found for this course.")
  }

  const row = rows[0]
  const st = String(row.status)
  const nextStatus = statusAfterInstructorSaveLetterText(st, finalText.trim().length > 0)

  if (nextStatus && nextStatus !== st) {
    await sql`
      UPDATE recommendation_requests
      SET final_letter_text = ${finalText},
          status = ${nextStatus},
          updated_at = NOW()
      WHERE id = ${requestId}
    `
    await logRecommendationAudit({
      requestId,
      actorType: "instructor",
      actorId: params.instructorId,
      action: "final_text_edited",
      details: { nextStatus },
    })
  } else {
    await sql`
      UPDATE recommendation_requests
      SET final_letter_text = ${finalText},
          updated_at = NOW()
      WHERE id = ${requestId}
    `
    await logRecommendationAudit({
      requestId,
      actorType: "instructor",
      actorId: params.instructorId,
      action: "final_text_edited",
      details: {},
    })
  }

  return { requestId, href: "/module/recommendations" }
}
