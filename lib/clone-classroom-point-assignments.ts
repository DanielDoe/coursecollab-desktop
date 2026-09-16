import { sql } from "@/lib/db"

/** Copy assignment definitions only — never student classroom_points rows. */
export async function cloneClassroomPointAssignmentsToCourse(input: {
  sourceCourseId: number
  destinationCourseId: number
  destinationInstructorId: number
  destinationSessionCode?: string | null
}): Promise<number> {
  const { sourceCourseId, destinationInstructorId, destinationSessionCode } = input

  const destSession =
    destinationSessionCode != null && String(destinationSessionCode).trim()
      ? String(destinationSessionCode).trim()
      : null

  const srcRows = (await sql`
    SELECT cps.*
    FROM classroom_point_submissions cps
    WHERE (
      (
        cps.session IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM sessions sess
          WHERE TRIM(sess.code) = TRIM(cps.session)
            AND sess.course_id = ${sourceCourseId}
        )
      )
      OR (
        cps.session IS NULL
        AND EXISTS (
          SELECT 1 FROM courses c
          WHERE c.id = ${sourceCourseId}
            AND c.course_code LIKE 'ELEG%'
        )
      )
    )
    ORDER BY cps.id
  `) as Record<string, unknown>[]

  let count = 0
  for (const row of srcRows) {
    const title = String(row.title ?? "Untitled assignment")
    const description = row.description != null ? String(row.description) : null
    const sessionRaw = row.session != null ? String(row.session).trim() : ""
    const session = destSession ?? (sessionRaw || null)
    const durationHours =
      row.duration_hours != null && Number.isFinite(Number(row.duration_hours))
        ? Number(row.duration_hours)
        : null
    const dueAtRaw = row.due_at != null ? new Date(String(row.due_at)) : null
    const dueAt =
      dueAtRaw && !Number.isNaN(dueAtRaw.getTime()) && dueAtRaw.getTime() > Date.now()
        ? dueAtRaw
        : null
    const questionConfig = row.question_config ?? null
    const kind = String(row.submission_kind ?? "code").toLowerCase() === "solution" ? "solution" : "code"

    const existing = (await sql`
      SELECT id FROM classroom_point_submissions
      WHERE title = ${title}
        AND created_by = ${destinationInstructorId}
        AND session IS NOT DISTINCT FROM ${session}
      LIMIT 1
    `) as { id: number }[]
    if (existing.length > 0) continue

    await sql`
      INSERT INTO classroom_point_submissions (
        title, description, session, created_by, duration_hours, due_at,
        question_config, submission_kind, hidden_from_students
      )
      VALUES (
        ${title},
        ${description},
        ${session},
        ${destinationInstructorId},
        ${dueAt ? null : durationHours},
        ${dueAt},
        ${questionConfig},
        ${kind},
        true
      )
    `
    count += 1
  }

  return count
}
