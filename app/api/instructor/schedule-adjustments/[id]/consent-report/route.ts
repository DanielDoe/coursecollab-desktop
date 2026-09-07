import { type NextRequest, NextResponse } from "next/server"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { getRequestById, getConsentCounts, getConsentRoster } from "@/lib/schedule-adjustment/workflow-service"
import { instructorCanAccessScheduleRequest } from "@/lib/schedule-adjustment/section-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { buildConsentReportPdf } from "@/lib/schedule-adjustment/consent-report-pdf"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireCoursePermission(request, ["manage_course_settings", "view_analytics"])
  if (!ctx.ok) return ctx.response

  const { id } = await context.params
  const requestId = Number(id)
  const row = await getRequestById(requestId)
  if (!row || !instructorCanAccessScheduleRequest(row, ctx.course.id, readInstructorSessionScopeFromRequest(request).sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const instructor = await sql`
    SELECT COALESCE(NULLIF(TRIM(full_name), ''), username) AS name
    FROM instructors WHERE id = ${row.created_by_id} LIMIT 1
  `
  const instructorName = String((instructor[0] as { name?: string } | undefined)?.name ?? "Instructor")
  const [counts, roster] = await Promise.all([getConsentCounts(requestId), getConsentRoster(requestId, "all")])

  const bytes = buildConsentReportPdf({
    request: row,
    instructorName,
    courseTitle: ctx.course.course_title ?? ctx.course.course_code ?? "Course",
    semester: "Fall 2026",
    generatedBy: instructorName,
    roster: roster as never[],
    counts,
  })

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="consent-report-${row.section_code ?? requestId}.pdf"`,
    },
  })
}
