import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { readStudentCatalogScopeFromRequest } from "@/lib/group-project-term-scope"
import {
  rosterClientMatchesEnrollment,
  rosterLookupFromEnrollment,
} from "@/lib/student-roster-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const ctx = await resolveStudentCourseContextByDbId(auth.studentDbId, readStudentCatalogScopeFromRequest(request))
    if (!ctx) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    if (
      !rosterClientMatchesEnrollment(
        { section: ctx.section, sessionCode: ctx.sessionCode, courseId: ctx.courseId },
        { section: searchParams.get("section"), courseId: searchParams.get("courseId") },
      )
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { section, courseId } = rosterLookupFromEnrollment({
      section: ctx.section,
      sessionCode: ctx.sessionCode,
      courseId: ctx.courseId,
    })

    if (!ctx.sessionId) {
      return NextResponse.json({ error: "Session not resolved for enrollment" }, { status: 400 })
    }

    if (!section) {
      return NextResponse.json({ error: "Section is required" }, { status: 400 })
    }

    const variants = normalizedSectionVariantsForSql(section)
    if (variants.length === 0) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    const sessionHit =
      courseId != null && Number.isFinite(courseId)
        ? await sql`
            SELECT 1 FROM sessions
            WHERE id = ${ctx.sessionId}
              AND course_id = ${courseId}
              AND TRIM(code) = ANY(${variants}::text[])
            LIMIT 1
          `
        : await sql`
            SELECT 1 FROM sessions
            WHERE id = ${ctx.sessionId}
              AND TRIM(code) = ANY(${variants}::text[])
            LIMIT 1
          `
    if (sessionHit.length === 0) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    const students = await sql`
      SELECT s.id, s.student_id, s.full_name
      FROM students s
      WHERE s.session_id = ${ctx.sessionId}
      ORDER BY s.full_name ASC
    `

    return NextResponse.json({ students })
  } catch (error) {
    console.error("[v0] Failed to fetch roster:", error)
    return NextResponse.json({ error: "Failed to fetch roster" }, { status: 400 })
  }
}
