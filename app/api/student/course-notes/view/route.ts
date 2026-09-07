import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  fetchPublishedCourseNotesForStudent,
  fetchCourseDigitalNoteById,
} from "@/lib/course-digital-notes"
import { publishedCourseNotesLookupFromEnrollment } from "@/lib/student-course-notes-scope"
import { recordCourseNoteView } from "@/lib/course-note-view-scoring"
import { getWeekStartDateString } from "@/lib/trade-center-shared"
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema"
import { parseTradeCenterConfigRow, DEFAULT_TRADE_CENTER_CONFIG } from "@/lib/trade-center-shared"

export const dynamic = "force-dynamic"

async function resolveStudentCourseContext(studentDbId: number) {
  const rows = await sql`
    SELECT s.section, c.id AS course_id
    FROM students s
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${studentDbId} AND s.deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) return { session: null as string | null, courseId: null as number | null }
  const row = rows[0] as { section: string | null; course_id: number | null }
  return {
    session: row.section ?? null,
    courseId: row.course_id != null ? Number(row.course_id) : null,
  }
}

async function isNoteReadableByStudent(
  studentDbId: number,
  noteId: number,
): Promise<boolean> {
  const note = await fetchCourseDigitalNoteById(noteId)
  if (!note || !note.is_published) return false

  const ctx = await resolveStudentCourseContext(studentDbId)
  const { courseId, session } = publishedCourseNotesLookupFromEnrollment(ctx, {})
  if (courseId == null || note.course_id !== courseId) return false

  const visible = await fetchPublishedCourseNotesForStudent({ courseId, session })
  return visible.some((n) => n.id === noteId)
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => ({}))) as { noteId?: number }
    const noteId = Number(body.noteId)
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return NextResponse.json({ error: "Valid noteId is required" }, { status: 400 })
    }

    const allowed = await isNoteReadableByStudent(auth.studentDbId, noteId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    let weeklyResetDay = DEFAULT_TRADE_CENTER_CONFIG.weekly_reset_day
    try {
      await ensureTradeCenterConfigSchema()
      const student = await sql`SELECT section FROM students WHERE id = ${auth.studentDbId} LIMIT 1`
      const session = String(student[0]?.section ?? "ALL")
      const cfg = await sql`
        SELECT * FROM trade_center_config
        WHERE (session = ${session} OR session = 'ALL') AND is_active = true
        ORDER BY CASE WHEN session = ${session} THEN 0 ELSE 1 END
        LIMIT 1
      `
      if (cfg.length > 0) {
        weeklyResetDay = parseTradeCenterConfigRow(cfg[0] as Record<string, unknown>).weekly_reset_day
      }
    } catch {
      /* defaults */
    }

    const weekStartDate = getWeekStartDateString(new Date(), weeklyResetDay)
    const firstViewThisWeek = await recordCourseNoteView(
      noteId,
      auth.studentDbId,
      weekStartDate,
    )

    if (firstViewThisWeek) {
      try {
        const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
        const student = await sql`
          SELECT section FROM students WHERE id = ${auth.studentDbId}
        `
        const session = student[0]?.section || "ALL"
        await syncActivityPointsAfterAction(auth.studentDbId, session, "lecture")
      } catch {
        /* non-blocking */
      }
    }

    return NextResponse.json({ success: true, firstViewThisWeek })
  } catch (error) {
    console.error("[student/course-notes/view POST]", error)
    return NextResponse.json({ error: "Failed to record note view" }, { status: 500 })
  }
}
