import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  elegSharedLectureStudentBundleSql,
  isElegSharedLectureCourseCode,
} from "@/lib/instructor-default-courses"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  courseOwnerIdForActor,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"
import { requireLectureCatalogCaller } from "@/lib/lecture-catalog-auth"
import { redactStudentLectureRecords } from "@/lib/student-lecture-redact"
import { applySignedLectureDeckUrlsToRows } from "@/lib/lecture-deck-signed-url"
import { getStudentLectureSessionByDbId } from "@/lib/student-lecture-access"

export const dynamic = "force-dynamic"
export const revalidate = 60
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const perfStart = Date.now()

  try {
    const caller = await requireLectureCatalogCaller(request)
    if (!caller.ok) return caller.response

    const { searchParams } = new URL(request.url)
    const weekRaw = searchParams.get("week")
    const week = weekRaw ? Number.parseInt(weekRaw, 10) : NaN
    const weekFilter = Number.isFinite(week) ? week : null
    const includeUnpublished = searchParams.get("includeUnpublished") === "true"

    if (caller.role === "student") {
      const sessionRow = await getStudentLectureSessionByDbId(caller.studentDbId)
      if (!sessionRow) {
        return NextResponse.json({ error: "Student session not found" }, { status: 404 })
      }
      const sessCourseId = sessionRow.session_course_id
      const sessionInstructorId = sessionRow.session_instructor_id
      const elegSharedForStudent =
        sessionInstructorId != null && isElegSharedLectureCourseCode(sessionRow.session_course_code)
          ? elegSharedLectureStudentBundleSql(sessionInstructorId)
          : sql.unsafe("(FALSE)")

      const lectures = weekFilter != null
        ? await sql`
            SELECT * FROM lectures l
            WHERE l.week = ${weekFilter}
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND l.deleted_at IS NULL
              AND (
                l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                OR (${elegSharedForStudent})
              )
            ORDER BY created_at ASC
          `
        : await sql`
            SELECT * FROM lectures l
            WHERE COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND l.deleted_at IS NULL
              AND (
                l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                OR (${elegSharedForStudent})
              )
            ORDER BY week ASC, created_at ASC
          `

      console.log(
        `[Perf] /api/lectures GET completed in ${Date.now() - perfStart}ms (${lectures.length} lectures)`,
      )
      return NextResponse.json({
        lectures: applySignedLectureDeckUrlsToRows(
          redactStudentLectureRecords(lectures as Record<string, unknown>[]),
          { studentDbId: caller.studentDbId, origin: request.nextUrl.origin },
        ),
      })
    }

    const actor = await loadInstructorActor(caller.instructorId)
    if (!actor || !actor.is_active) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const ownerId = courseOwnerIdForActor(actor)
    const publishedClause = includeUnpublished
      ? sql.unsafe("TRUE")
      : sql.unsafe("COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE")

    const lectures = weekFilter != null
      ? await sql`
          SELECT l.*
          FROM lectures l
          INNER JOIN courses c ON c.id = l.course_id
          WHERE l.week = ${weekFilter}
            AND l.deleted_at IS NULL
            AND (${publishedClause})
            AND c.instructor_id = ${ownerId}
            AND c.is_active = true
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT l.*
          FROM lectures l
          INNER JOIN courses c ON c.id = l.course_id
          WHERE l.deleted_at IS NULL
            AND (${publishedClause})
            AND c.instructor_id = ${ownerId}
            AND c.is_active = true
          ORDER BY week ASC, created_at ASC
        `

    console.log(
      `[Perf] /api/lectures GET completed in ${Date.now() - perfStart}ms (${lectures.length} lectures)`,
    )
    return NextResponse.json({
      lectures: includeUnpublished
        ? lectures
        : redactStudentLectureRecords(lectures as Record<string, unknown>[]),
    })
  } catch (error) {
    console.error("Failed to fetch lectures:", error)
    console.log(`[Perf] /api/lectures GET failed after ${Date.now() - perfStart}ms`)
    return NextResponse.json({ error: "Failed to fetch lectures" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const { week, title, session, description, materials_url, session_access, is_published } = body

    const result = await sql`
      INSERT INTO lectures (
        week, title, session, description, materials_url, session_access, is_published, course_id
      )
      VALUES (
        ${week},
        ${title},
        ${session || null},
        ${description},
        ${materials_url || null},
        ${session_access || null},
        ${is_published !== undefined ? is_published : true},
        ${scope.course.id}
      )
      RETURNING *
    `

    return NextResponse.json({ lecture: result[0] })
  } catch (error) {
    console.error("Failed to create lecture:", error)
    return NextResponse.json({ error: "Failed to create lecture" }, { status: 500 })
  }
}
