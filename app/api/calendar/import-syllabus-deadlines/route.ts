import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { getSyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import {
  extractSyllabusDeadlines,
  syllabusDeadlineToCalendarTimes,
  type SyllabusDeadlineRow,
} from "@/lib/calendar/syllabus-deadlines"
import { parseSyllabusDate } from "@/lib/syllabus/calendar-export"

export const dynamic = "force-dynamic"

type ImportDeadlineInput = {
  title?: string
  dateText?: string
  key?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      studentId?: string | number
      importAll?: boolean
      deadlines?: ImportDeadlineInput[]
    }

    const studentIdRaw = body.studentId
    if (studentIdRaw == null) {
      return NextResponse.json({ success: false, error: "studentId is required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, String(studentIdRaw))
    if (!auth.ok) return auth.response

    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const syllabus = await getSyllabusByCourseId(resolved.ctx.courseId, resolved.ctx.sessionId)
    if (!syllabus || syllabus.status !== "published") {
      return NextResponse.json(
        { success: false, error: "Syllabus is not published for this course." },
        { status: 404 },
      )
    }

    const courseInfo = await getSyllabusCourseInfo(resolved.ctx.courseId)
    const courseTitle =
      courseInfo?.courseTitle || courseInfo?.courseCode || syllabus.title || "Course"

    let rows: SyllabusDeadlineRow[] = extractSyllabusDeadlines({
      ...syllabus,
      sections: syllabus.sections.filter((s) => s.isVisible),
    })

    if (!body.importAll && Array.isArray(body.deadlines) && body.deadlines.length > 0) {
      const keys = new Set(
        body.deadlines.map((d) => d.key?.trim().toLowerCase()).filter(Boolean) as string[],
      )
      if (keys.size > 0) {
        rows = rows.filter((r) => keys.has(r.key.toLowerCase()))
      } else {
        rows = body.deadlines
          .filter((d) => d.title?.trim() && d.dateText?.trim())
          .map((d) => {
            const title = d.title!.trim()
            const dateText = d.dateText!.trim()
            return {
              key: `${dateText.toLowerCase()}|${title.toLowerCase()}`,
              title,
              dateText,
              parsedDate: parseSyllabusDate(dateText),
              source: "syllabus",
            } satisfies SyllabusDeadlineRow
          })
      }
    }

    const valid = rows.filter((r) => r.parsedDate != null)
    if (valid.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: rows.length,
        message: "No parseable syllabus due dates found.",
      })
    }

    let imported = 0
    let skipped = 0

    for (const row of valid) {
      const { start_time, end_time, all_day } = syllabusDeadlineToCalendarTimes(row.parsedDate!)
      const title = `${courseTitle}: ${row.title}`
      const description = `From syllabus (${row.source}). Due ${row.dateText}.`

      const existing = await sql`
        SELECT id FROM calendar_events
        WHERE student_id = ${auth.studentDbId}
          AND related_type = 'syllabus_deadline'
          AND title = ${title}
          AND start_time::date = ${start_time}::timestamptz::date
        LIMIT 1
      `
      if (existing.length > 0) {
        skipped++
        continue
      }

      await sql`
        INSERT INTO calendar_events (
          student_id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          all_day,
          color,
          reminder_minutes,
          related_type
        ) VALUES (
          ${auth.studentDbId},
          ${title},
          ${description},
          'assignment',
          ${start_time},
          ${end_time},
          ${all_day},
          '#f59e0b',
          1440,
          'syllabus_deadline'
        )
      `
      imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: valid.length,
      message:
        imported > 0
          ? `Added ${imported} syllabus due date${imported === 1 ? "" : "s"} to your CourseCollab calendar.`
          : skipped > 0
            ? "Those syllabus due dates are already on your calendar."
            : "No due dates were imported.",
    })
  } catch (error) {
    console.error("[Calendar Import Syllabus Deadlines]", error)
    return NextResponse.json(
      { success: false, error: "Failed to import syllabus due dates" },
      { status: 500 },
    )
  }
}
