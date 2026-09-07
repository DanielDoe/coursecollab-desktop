import { sql } from "@/lib/db"
import { ensureCourseDigitalNotesSchema, mapCourseDigitalNote } from "@/lib/course-digital-notes"

export async function createInstructorCourseNote(params: {
  instructorId: number
  courseId: number
  title: string
  bodyText: string
  topic?: string | null
  session?: string | null
  isPublished?: boolean
}): Promise<{ noteId: number; title: string; href: string }> {
  await ensureCourseDigitalNotesSchema()

  const title = String(params.title ?? "Untitled note").trim() || "Untitled note"
  const bodyText = String(params.bodyText ?? "")
  const topic = params.topic != null ? String(params.topic).trim() || null : null
  const sessionRaw = params.session != null ? String(params.session).trim() : ""
  const session = sessionRaw && sessionRaw !== "ALL" ? sessionRaw : null
  const isPublished = Boolean(params.isPublished)

  const rows = await sql`
    INSERT INTO course_digital_notes (
      course_id, instructor_id, topic, title, body_text, ink_workspace, session, is_published
    )
    VALUES (
      ${params.courseId}, ${params.instructorId}, ${topic}, ${title}, ${bodyText}, NULL, ${session}, ${isPublished}
    )
    RETURNING *
  `

  const note = mapCourseDigitalNote(rows[0] as never)
  return {
    noteId: Number(note.id),
    title: note.title,
    href: "/module/course-notes",
  }
}
