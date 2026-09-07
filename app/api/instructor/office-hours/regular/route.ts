import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ensureOfficeHoursCourseScopeColumns,
  hasRegularOfficeHoursCourseIdColumn,
} from "@/lib/office-hours-course-scope"

export const dynamic = "force-dynamic"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function formatRegularRows(rows: unknown[]) {
  return (rows as any[]).map((r) => ({
    id: r.id,
    dayOfWeek: r.day_of_week,
    dayName: DAY_NAMES[r.day_of_week],
    startTime: typeof r.start_time === "string" ? r.start_time.slice(0, 5) : r.start_time,
    endTime: typeof r.end_time === "string" ? r.end_time.slice(0, 5) : r.end_time,
    semesterLabel: r.semester_label,
    courseId: r.course_id ?? null,
  }))
}

/** GET - List regular office hours for the selected course */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureOfficeHoursCourseScopeColumns()
    const courseId = scope.course.id
    const hasCourseCol = await hasRegularOfficeHoursCourseIdColumn()

    const rows = hasCourseCol
      ? await sql`
          SELECT id, day_of_week, start_time, end_time, semester_label, course_id
          FROM regular_office_hours
          WHERE course_id = ${courseId}
          ORDER BY day_of_week, start_time
        `
      : await sql`
          SELECT id, day_of_week, start_time, end_time, semester_label
          FROM regular_office_hours
          WHERE 1 = 0
          ORDER BY day_of_week, start_time
        `

    return NextResponse.json({ regularHours: formatRegularRows(rows) })
  } catch (error) {
    console.error("[Regular Office Hours] GET:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

/** POST - Replace regular office hours for the selected course */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureOfficeHoursCourseScopeColumns()
    const courseId = scope.course.id
    const hasCourseCol = await hasRegularOfficeHoursCourseIdColumn()
    if (!hasCourseCol) {
      return NextResponse.json({ error: "Office hours course scope is not available yet" }, { status: 503 })
    }

    const body = await request.json()
    const { slots = [], semesterLabel = "current" } = body
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "slots array required" }, { status: 400 })
    }

    await sql`
      DELETE FROM regular_office_hours
      WHERE semester_label = ${semesterLabel}
        AND course_id = ${courseId}
    `

    for (const s of slots) {
      const { dayOfWeek, startTime, endTime } = s
      if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6 || !startTime || !endTime) continue
      await sql`
        INSERT INTO regular_office_hours (day_of_week, start_time, end_time, semester_label, course_id, updated_at)
        VALUES (${dayOfWeek}, ${startTime}, ${endTime}, ${semesterLabel}, ${courseId}, NOW())
      `
    }

    const rows = await sql`
      SELECT id, day_of_week, start_time, end_time, semester_label, course_id
      FROM regular_office_hours
      WHERE course_id = ${courseId}
      ORDER BY day_of_week, start_time
    `
    return NextResponse.json({ success: true, regularHours: formatRegularRows(rows) })
  } catch (error) {
    console.error("[Regular Office Hours] POST:", error)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
