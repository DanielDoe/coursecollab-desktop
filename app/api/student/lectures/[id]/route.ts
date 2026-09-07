import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { redactStudentLectureRecord } from "@/lib/student-lecture-redact"
import { applySignedLectureDeckUrls } from "@/lib/lecture-deck-signed-url"

export const dynamic = "force-dynamic"

/**
 * Student lecture detail — used by mobile (`studentApi.getLectureById`).
 * Mirrors list fields from `/api/student/lectures` for a single accessible lecture.
 */
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

    const studentDbId = auth.studentDbId

    const rows = await sql`
      SELECT
        l.*,
        COALESCE(lsp.last_viewed_slide_order, 0) as current_slide,
        COALESCE(lsp.completed_slides, '[]'::jsonb) as completed_slides,
        0 as xp_earned,
        lsp.completed_at,
        lsp.last_accessed,
        COALESCE(lsp.status, 'not_started') as status,
        COALESCE(lsp.progress_percentage, 0) as progress_percentage,
        COALESCE(lsp.bookmarked_slides, '[]'::jsonb) as bookmarked_slides
      FROM lectures l
      LEFT JOIN lecture_student_progress lsp
        ON l.id = lsp.lecture_id AND lsp.student_id = ${studentDbId}
      WHERE l.id = ${lectureId}
        AND l.deleted_at IS NULL
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      lecture: applySignedLectureDeckUrls(
        redactStudentLectureRecord(rows[0] as Record<string, unknown>),
        { studentDbId, origin: request.nextUrl.origin },
      ),
    })
  } catch (error) {
    console.error("[Student lecture detail]", error)
    return NextResponse.json({ error: "Failed to load lecture" }, { status: 500 })
  }
}
