import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ensureOfficeHoursCourseScopeColumns,
  hasRegularOfficeHoursCourseIdColumn,
} from "@/lib/office-hours-course-scope"
import { ensureOfficeHoursPublicProfileSchema } from "@/lib/office-hours-public-profile"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"

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
    sessionId: r.session_id ?? null,
    academicTermId: r.academic_term_id ?? null,
  }))
}

/** Neon rejects nested sql`` fragments — build a parameterized predicate via sql.unsafe ints only. */
function regularHoursOfferingPred(input: {
  courseId: number
  sessionId: number | null
  academicTermId: number | null
}): string {
  const courseId = Math.trunc(Number(input.courseId))
  if (!Number.isFinite(courseId) || courseId < 1) return `(FALSE)`
  const sessionId =
    input.sessionId != null && Number.isFinite(input.sessionId) && input.sessionId > 0
      ? Math.trunc(input.sessionId)
      : null
  const academicTermId =
    input.academicTermId != null && Number.isFinite(input.academicTermId) && input.academicTermId > 0
      ? Math.trunc(input.academicTermId)
      : null

  if (sessionId != null) {
    if (academicTermId != null) {
      return `(
        course_id = ${courseId}
        AND (
          session_id = ${sessionId}
          OR (
            session_id IS NULL
            AND (academic_term_id = ${academicTermId} OR academic_term_id IS NULL)
          )
        )
      )`
    }
    return `(
      course_id = ${courseId}
      AND (
        session_id = ${sessionId}
        OR (session_id IS NULL AND academic_term_id IS NULL)
      )
    )`
  }
  if (academicTermId != null) {
    return `(
      course_id = ${courseId}
      AND (
        academic_term_id = ${academicTermId}
        OR (academic_term_id IS NULL AND session_id IS NULL)
      )
    )`
  }
  return `(course_id = ${courseId})`
}

/** GET - List regular office hours for the selected course offering */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureOfficeHoursCourseScopeColumns()
    await ensureOfficeHoursPublicProfileSchema()
    const courseId = scope.course.id
    const hasCourseCol = await hasRegularOfficeHoursCourseIdColumn()
    const offering = readInstructorSessionScopeFromRequest(request)
    const offeringPred = regularHoursOfferingPred({
      courseId,
      sessionId: offering.sessionId,
      academicTermId: offering.academicTermId,
    })

    const rows = hasCourseCol
      ? await sql`
          SELECT id, day_of_week, start_time, end_time, semester_label, course_id, session_id, academic_term_id
          FROM regular_office_hours
          WHERE ${sql.unsafe(offeringPred)}
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

/** POST - Replace regular office hours for the selected course offering */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureOfficeHoursCourseScopeColumns()
    await ensureOfficeHoursPublicProfileSchema()
    const courseId = scope.course.id
    const hasCourseCol = await hasRegularOfficeHoursCourseIdColumn()
    if (!hasCourseCol) {
      return NextResponse.json({ error: "Office hours course scope is not available yet" }, { status: 503 })
    }

    const offering = readInstructorSessionScopeFromRequest(request)
    const body = await request.json()
    const { slots = [], semesterLabel = "current" } = body
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "slots array required" }, { status: 400 })
    }

    // Replace only slots for this offering (session/term), not every course-wide row.
    if (offering.sessionId != null) {
      await sql`
        DELETE FROM regular_office_hours
        WHERE semester_label = ${semesterLabel}
          AND course_id = ${courseId}
          AND session_id = ${offering.sessionId}
      `
    } else if (offering.academicTermId != null) {
      await sql`
        DELETE FROM regular_office_hours
        WHERE semester_label = ${semesterLabel}
          AND course_id = ${courseId}
          AND academic_term_id = ${offering.academicTermId}
          AND session_id IS NULL
      `
    } else {
      await sql`
        DELETE FROM regular_office_hours
        WHERE semester_label = ${semesterLabel}
          AND course_id = ${courseId}
          AND session_id IS NULL
          AND academic_term_id IS NULL
      `
    }

    for (const s of slots) {
      const { dayOfWeek, startTime, endTime } = s
      if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6 || !startTime || !endTime) continue
      await sql`
        INSERT INTO regular_office_hours (
          day_of_week, start_time, end_time, semester_label, course_id,
          session_id, academic_term_id, instructor_id, updated_at
        )
        VALUES (
          ${dayOfWeek}, ${startTime}, ${endTime}, ${semesterLabel}, ${courseId},
          ${offering.sessionId}, ${offering.academicTermId}, ${scope.instructorId}, NOW()
        )
      `
    }

    const offeringPred = regularHoursOfferingPred({
      courseId,
      sessionId: offering.sessionId,
      academicTermId: offering.academicTermId,
    })
    const rows = await sql`
      SELECT id, day_of_week, start_time, end_time, semester_label, course_id, session_id, academic_term_id
      FROM regular_office_hours
      WHERE ${sql.unsafe(offeringPred)}
      ORDER BY day_of_week, start_time
    `
    return NextResponse.json({ success: true, regularHours: formatRegularRows(rows) })
  } catch (error) {
    console.error("[Regular Office Hours] POST:", error)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
