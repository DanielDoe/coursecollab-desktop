import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { mapLectureRowToViewerPayload } from "@/lib/map-lecture-for-viewer"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { applySignedLectureDeckUrls } from "@/lib/lecture-deck-signed-url"

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const auth = await requireStudentLectureCaller(
      request,
      request.nextUrl.searchParams.get("studentId"),
    )
    if (!auth.ok) return auth.response

    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const rows = await sql`
      SELECT *
      FROM lectures
      WHERE id = ${lectureId}
        AND deleted_at IS NULL
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
      content: parseSlideContent(slide.content),
    }))

    const payload = mapLectureRowToViewerPayload(
      applySignedLectureDeckUrls(lectureRow, {
        studentDbId: auth.studentDbId,
        origin: request.nextUrl.origin,
      }),
      slides,
    )

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[Student lecture content]", error)
    return NextResponse.json({ error: "Failed to load lecture" }, { status: 500 })
  }
}
