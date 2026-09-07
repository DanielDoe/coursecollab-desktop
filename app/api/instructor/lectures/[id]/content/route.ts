import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildLectureInstructorCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { mapLectureRowToViewerPayload } from "@/lib/map-lecture-for-viewer"

export const dynamic = "force-dynamic"

/** Full lecture payload for instructor preview (course-scoped). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )

    const rows = await sql`
      SELECT l.*
      FROM lectures l
      WHERE l.id = ${lectureId}
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const lectureRow = rows[0] as Record<string, unknown>

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
      WHERE lecture_id = ${lectureId}
      ORDER BY slide_order ASC
    `

    const slides = slidesRaw.map((slide) => ({
      ...slide,
      content: slide.content
        ? typeof slide.content === "string"
          ? JSON.parse(slide.content as string)
          : slide.content
        : null,
    }))

    const payload = mapLectureRowToViewerPayload(lectureRow, slides)

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[Instructor lecture content]", error)
    return NextResponse.json({ error: "Failed to load lecture" }, { status: 500 })
  }
}
