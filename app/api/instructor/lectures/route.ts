import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildLectureInstructorCourseScopeSqlFragment,
  isElegSharedLectureCourseCode,
  syncLectureCourseIdsForElegEceInstructor,
} from "@/lib/instructor-default-courses"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"
import {
  dedupeElegSharedLectureRows,
  formatElegLectureDisplayTitle,
} from "@/lib/lecture-index-label"
import {
  replaceLectureSessionAccessFromRecord,
} from "@/lib/lecture-session-access-sync"
import { softDeleteInstructorOwnedLecture } from "@/lib/instructor-lecture-delete"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function sessionAccessJsonForColumn(sessionAccess: unknown): string | null {
  if (sessionAccess === null || sessionAccess === undefined) return null
  return JSON.stringify(sessionAccess)
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { course } = scope
    const week = request.nextUrl.searchParams.get("week")
    const courseId = course.id

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
    const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
      courseId,
      scope.instructorId,
      course.course_code,
      selectedSessionCode,
    )

    const lectures = week
      ? await sql`
        SELECT 
          l.*,
          0 as students_viewed,
          0 as avg_xp
        FROM lectures l
        WHERE l.week = ${parseInt(week, 10)}
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
        ORDER BY l.week ASC, l.created_at DESC
      `
      : await sql`
        SELECT 
          l.*,
          0 as students_viewed,
          0 as avg_xp
        FROM lectures l
        WHERE l.deleted_at IS NULL
        AND (${scopeWhere})
        ORDER BY l.week ASC, l.created_at DESC
      `

    let rows = lectures as Record<string, unknown>[]
    if (isElegSharedLectureCourseCode(course.course_code)) {
      const sessionIdRaw = request.headers.get("x-session-id")
      let scopeSessionCode: string | null = null
      if (sessionIdRaw && Number.isFinite(Number(sessionIdRaw))) {
        const sessRows = (await sql`
          SELECT code FROM sessions WHERE id = ${Math.trunc(Number(sessionIdRaw))} LIMIT 1
        `) as { code: string }[]
        scopeSessionCode = sessRows[0]?.code ?? null
      }
      rows = dedupeElegSharedLectureRows(
        rows as { id: number; week: number; title: string; course_id?: number | null; session?: string | null }[],
        courseId,
        scopeSessionCode,
      ) as Record<string, unknown>[]
    }

    const formatted = rows.map((row) => ({
      ...row,
      title: formatElegLectureDisplayTitle(String(row.title ?? ""), course.course_code),
    }))

    return NextResponse.json({ lectures: formatted })
  } catch (error) {
    console.error("Error fetching lectures:", error)
    return NextResponse.json({ error: "Failed to fetch lectures" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { course } = scope
    const courseId = course.id

    const body = await request.json()
    const {
      title,
      week,
      description,
      objectives,
      learning_objectives,
      session_access,
      is_active,
      is_published,
    } = body

    const titleText = String(title ?? "").trim()
    const weekNum = Number(week)
    if (!titleText) {
      return NextResponse.json({ error: "Lecture title is required." }, { status: 400 })
    }
    if (!Number.isFinite(weekNum) || weekNum < 0) {
      return NextResponse.json({ error: "Valid week number is required." }, { status: 400 })
    }

    const published =
      typeof is_active === "boolean"
        ? is_active
        : typeof is_published === "boolean"
          ? is_published
          : false

    const objectiveList = Array.isArray(learning_objectives)
      ? learning_objectives
      : Array.isArray(objectives)
        ? objectives
        : []
    const descriptionText = typeof description === "string" ? description : ""
    const sessionCol = sessionAccessJsonForColumn(session_access)

    const lecture = await sql`
      INSERT INTO lectures (
        title, week, description, learning_objectives,
        course_id, session_access, is_published, content_mode, allow_download,
        created_at, updated_at
      ) VALUES (
        ${titleText}, ${weekNum}, ${descriptionText},
        ${objectiveList.length ? JSON.stringify(objectiveList) : null},
        ${courseId}, ${sessionCol}, ${published}, ${"pdf"}, ${false},
        NOW(), NOW()
      ) RETURNING *
    `

    await replaceLectureSessionAccessFromRecord(sql, lecture[0].id, session_access)

    return NextResponse.json({ lecture: lecture[0] })
  } catch (error) {
    console.error("Error creating lecture:", error)
    return NextResponse.json(
      {
        error: "Failed to create lecture",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { course } = scope
    const courseId = course.id

    const body = await request.json()
    const {
      id,
      title,
      week,
      description,
      objectives,
      learning_objectives,
      session_access,
      is_active,
      is_published,
    } = body

    const published =
      typeof is_active === "boolean"
        ? is_active
        : typeof is_published === "boolean"
          ? is_published
          : true

    const objectiveList = Array.isArray(learning_objectives)
      ? learning_objectives
      : Array.isArray(objectives)
        ? objectives
        : []
    const sessionCol = sessionAccessJsonForColumn(session_access)

    const lecture = await sql`
      UPDATE lectures SET
        title = ${title},
        week = ${week},
        description = ${description},
        learning_objectives = ${objectiveList.length ? JSON.stringify(objectiveList) : null},
        session_access = ${sessionCol},
        course_id = ${courseId},
        is_published = ${published},
        updated_at = NOW()
      WHERE id = ${id}
        AND (course_id = ${courseId} OR course_id IS NULL)
      RETURNING *
    `

    if (lecture.length === 0) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    await replaceLectureSessionAccessFromRecord(sql, id, session_access)

    return NextResponse.json({ lecture: lecture[0] })
  } catch (error) {
    console.error("Error updating lecture:", error)
    return NextResponse.json({ error: "Failed to update lecture" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const lectureId = request.nextUrl.searchParams.get("id")
    if (!lectureId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const result = await softDeleteInstructorOwnedLecture(request, parseInt(lectureId, 10))
    if (!result.ok) return result.response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting lecture:", error)
    return NextResponse.json({ error: "Failed to delete lecture" }, { status: 500 })
  }
}
