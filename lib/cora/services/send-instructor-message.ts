/**
 * Thin wrapper so Cora confirmations call the same DM service as the Messages UI.
 */

import { sendDirectMessage } from "@/lib/direct-messages/service"
import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

export async function sendInstructorDirectMessage(input: {
  instructorId: number
  courseId: number
  recipientStudentId: number
  subject?: string | null
  body: string
  existingThreadId?: number | null
}): Promise<{ threadId: number; messageId: number; recipientName: string }> {
  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) {
    throw new Error("Instructor cannot message students for this course.")
  }

  const recipientStudentId = Number(input.recipientStudentId)
  if (!Number.isFinite(recipientStudentId) || recipientStudentId <= 0) {
    throw new Error("Valid recipient student id is required.")
  }

  const body = String(input.body ?? "").trim()
  if (!body) throw new Error("Message body is required.")

  const enrolled = (await sql`
    SELECT s.id, s.full_name
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${recipientStudentId}
      AND (
        s.course_id = ${input.courseId}
        OR sess.course_id = ${input.courseId}
      )
    LIMIT 1
  `.catch(async () => {
    return sql`
      SELECT s.id, s.full_name
      FROM students s
      WHERE s.id = ${recipientStudentId}
      LIMIT 1
    `
  })) as unknown as Array<{ id: number; full_name: string | null }>

  if (!enrolled.length) {
    throw new Error("Recipient is not an enrolled student in this course.")
  }

  const recipientName = String(enrolled[0]?.full_name ?? `Student ${recipientStudentId}`)

  const result = await sendDirectMessage({
    sender: { kind: "instructor", id: input.instructorId },
    recipientKind: "student",
    recipientId: recipientStudentId,
    subject: input.subject?.trim() || null,
    body,
    existingThreadId: input.existingThreadId ?? null,
  })

  return { ...result, recipientName }
}
