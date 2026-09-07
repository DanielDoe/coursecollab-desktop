import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import { rowToRequest, syncRequestStatus } from "@/lib/schedule-adjustment/workflow-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const ctx = await resolveStudentCourseContextByDbId(auth.studentDbId)
    if (!ctx) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const rows =
      ctx.sessionId != null
        ? await sql`
            SELECT r.*
            FROM schedule_adjustment_requests r
            WHERE r.status NOT IN ('DRAFT', 'CANCELLED', 'REJECTED')
              AND (
                EXISTS (
                  SELECT 1 FROM schedule_enrollment_snapshots s
                  WHERE s.request_id = r.id AND s.student_id = ${auth.studentDbId}
                )
                OR (
                  r.course_id = ${ctx.courseId}
                  AND r.section_id = ${ctx.sessionId}
                )
              )
            ORDER BY r.created_at DESC
          `
        : await sql`
            SELECT r.*
            FROM schedule_adjustment_requests r
            WHERE r.status NOT IN ('DRAFT', 'CANCELLED', 'REJECTED')
              AND (
                r.course_id = ${ctx.courseId}
                OR EXISTS (
                  SELECT 1 FROM schedule_enrollment_snapshots s
                  WHERE s.request_id = r.id AND s.student_id = ${auth.studentDbId}
                )
              )
            ORDER BY r.created_at DESC
          `

    const active = []
    for (const row of rows as Record<string, unknown>[]) {
      const req = await syncRequestStatus(rowToRequest(row))
      active.push(req)
    }

    return NextResponse.json({ success: true, requests: active })
  } catch (error) {
    console.error("[Student schedule adjustments GET]", error)
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 })
  }
}
