import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { mapLectureRowToViewerPayload } from "@/lib/map-lecture-for-viewer"
import {
  getStudentLectureSessionByDbId,
  isLectureAccessibleToStudent,
} from "@/lib/student-lecture-access"
import { requireLectureCatalogCaller } from "@/lib/lecture-catalog-auth"
import { applySignedLectureDeckUrls } from "@/lib/lecture-deck-signed-url"
import {
  courseOwnerIdForActor,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"

export const dynamic = "force-dynamic"

function parseSlideContent(content: unknown) {
  if (!content) return null
  if (typeof content !== "string") return content
  try {
    return JSON.parse(content) as unknown
  } catch {
    return content
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ week: string }> },
) {
  try {
    const caller = await requireLectureCatalogCaller(request)
    if (!caller.ok) return caller.response

    const { week: weekParam } = await params
    const week = parseInt(weekParam, 10)

    if (isNaN(week) || week < 1 || week > 16) {
      return NextResponse.json({ error: "Invalid week number" }, { status: 400 })
    }

    const lectureIdRaw = request.nextUrl.searchParams.get("lectureId")
    const lectureIdParsed = lectureIdRaw ? parseInt(lectureIdRaw, 10) : NaN
    const lectureIdParam = Number.isFinite(lectureIdParsed) ? lectureIdParsed : null

    let courseIdParam: number | null = null
    let instructorOwnerId: number | null = null

    if (caller.role === "student") {
      const sessionRow = await getStudentLectureSessionByDbId(caller.studentDbId)
      if (!sessionRow) {
        return NextResponse.json({ error: "Student session not found" }, { status: 404 })
      }
      const resolvedCourseId = sessionRow.session_course_id ?? sessionRow.student_course_id
      if (resolvedCourseId != null && Number.isFinite(Number(resolvedCourseId))) {
        courseIdParam = Number(resolvedCourseId)
      }
    } else {
      const actor = await loadInstructorActor(caller.instructorId)
      if (!actor || !actor.is_active) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      instructorOwnerId = courseOwnerIdForActor(actor)
      const courseIdRaw = request.nextUrl.searchParams.get("courseId")
      const courseIdParsed = courseIdRaw ? parseInt(courseIdRaw, 10) : NaN
      if (Number.isFinite(courseIdParsed)) {
        courseIdParam = courseIdParsed
      }
    }

    const rows =
      caller.role === "student"
        ? await sql`
            SELECT *
            FROM lectures l
            WHERE l.week = ${week}
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND l.deleted_at IS NULL
              AND (${lectureIdParam}::int IS NULL OR l.id = ${lectureIdParam})
              AND (
                ${courseIdParam}::int IS NULL
                OR l.course_id IS NOT DISTINCT FROM ${courseIdParam}
              )
            ORDER BY
              CASE
                WHEN ${courseIdParam}::int IS NOT NULL AND l.course_id IS NOT DISTINCT FROM ${courseIdParam} THEN 0
                WHEN l.course_id IS NULL THEN 1
                ELSE 2
              END,
              l.id DESC
            LIMIT 1
          `
        : await sql`
            SELECT l.*
            FROM lectures l
            INNER JOIN courses c ON c.id = l.course_id
            WHERE l.week = ${week}
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND l.deleted_at IS NULL
              AND c.instructor_id = ${instructorOwnerId}
              AND c.is_active = true
              AND (${lectureIdParam}::int IS NULL OR l.id = ${lectureIdParam})
              AND (
                ${courseIdParam}::int IS NULL
                OR l.course_id IS NOT DISTINCT FROM ${courseIdParam}
              )
            ORDER BY l.id DESC
            LIMIT 1
          `

    const lectureRow = rows[0] as Record<string, unknown> | undefined

    if (!lectureRow) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    const lectureDbId = Number(lectureRow.id)
    if (caller.role === "student") {
      const sessionRow = await getStudentLectureSessionByDbId(caller.studentDbId)
      const allowed = sessionRow
        ? await isLectureAccessibleToStudent(sessionRow.student_id, lectureDbId)
        : false
      if (!allowed) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }

    const slidesRaw = await sql`
      SELECT 
        id,
        slide_order,
        title,
        subtitle,
        content_type,
        content,
        background_gradient,
        ai_summary,
        ai_keywords
      FROM lecture_slides
      WHERE lecture_id = ${lectureDbId}
      ORDER BY slide_order ASC
    `

    const slides = slidesRaw.map((slide) => ({
      ...slide,
      content: parseSlideContent(slide.content),
    }))

    const signedRow =
      caller.role === "student"
        ? applySignedLectureDeckUrls(lectureRow, {
            studentDbId: caller.studentDbId,
            origin: request.nextUrl.origin,
          })
        : lectureRow
    const payload = mapLectureRowToViewerPayload(signedRow, slides)

    return NextResponse.json(payload)
  } catch (error) {
    console.error("Error fetching lecture:", error)
    return NextResponse.json({ error: "Failed to fetch lecture" }, { status: 500 })
  }
}
