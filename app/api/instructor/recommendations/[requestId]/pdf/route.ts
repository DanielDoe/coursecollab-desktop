import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { buildRecommendationLetterPdfBufferFromRow } from "@/lib/recommendation-letter-pdf-serve"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId
    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 })
    }

    const rows = sqlRows<Record<string, unknown>>(
      await sql`
        SELECT r.*, i.name AS instructor_name, s.full_name AS student_full_name
        FROM recommendation_requests r
        JOIN instructors i ON i.id = r.instructor_id
        JOIN students s ON s.id = r.student_id
        WHERE r.id = ${requestId} AND r.instructor_id = ${id}
        LIMIT 1
      `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const letter = String(rows[0].final_letter_text ?? "").trim()
    if (!letter) {
      return NextResponse.json({ error: "Add letter text before previewing the PDF." }, { status: 400 })
    }

    const buffer = await buildRecommendationLetterPdfBufferFromRow(rows[0], id)

    await logRecommendationAudit({
      requestId,
      actorType: "instructor",
      actorId: id,
      action: "pdf_preview_served",
      details: {},
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recommendation-${requestId}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (e) {
    console.error("[instructor recommendations pdf]", e)
    return NextResponse.json({ error: "PDF failed" }, { status: 500 })
  }
}
