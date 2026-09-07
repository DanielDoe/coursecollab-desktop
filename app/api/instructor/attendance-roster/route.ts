import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { instructorOwnsSectionVariants } from "@/lib/instructor-section-auth"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorAttendanceAccess } from "@/lib/instructor-attendance-auth"
import { resolveAttendanceInstructorScope } from "@/lib/attendance-instructor-scope"
import { fetchInstructorStudentsBySessionCode } from "@/lib/instructor-students-session-query"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET — Students roster for a section (for manual attendance check-in).
 * Instructor must own a session with matching section code.
 */
export async function GET(request: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(request)
    if (!attendanceAuth.ok) return attendanceAuth.response

    const instructorIdHeader = request.headers.get("x-instructor-id")?.trim()
    const instructorId =
      attendanceAuth.actorId > 0
        ? attendanceAuth.actorId
        : instructorIdHeader
          ? parseInt(instructorIdHeader, 10)
          : NaN
    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sectionRaw = request.nextUrl.searchParams.get("section")?.trim() ?? ""
    if (!sectionRaw) {
      return NextResponse.json({ error: "section is required" }, { status: 400 })
    }

    const variants = normalizedSectionVariantsForSql(sectionRaw)
    if (variants.length === 0) {
      return NextResponse.json({ students: [] })
    }

    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response

    const ownsSection = await instructorOwnsSectionVariants(
      instructorId,
      variants,
      scoped.courseId,
    )
    if (!ownsSection) {
      return NextResponse.json({ error: "No roster for this section under your account" }, { status: 403 })
    }

    const scope = await resolveAttendanceInstructorScope(request)

    if (scoped.courseId != null && scope.sessionId != null) {
      const rows = await sql`
        SELECT
          s.id AS student_id,
          s.full_name,
          s.student_id AS student_number,
          COALESCE(NULLIF(TRIM(s.section), ''), TRIM(sess.code)) AS section
        FROM students s
        INNER JOIN sessions sess ON s.session_id = sess.id
        WHERE s.session_id = ${scope.sessionId}
          AND sess.course_id = ${scoped.courseId}
          AND s.deleted_at IS NULL
        ORDER BY s.full_name ASC
      `
      return NextResponse.json({
        students: (rows as Record<string, unknown>[]).map((r) => ({
          studentId: Number(r.student_id),
          fullName: String(r.full_name ?? ""),
          studentNumber: String(r.student_number ?? ""),
          section: String(r.section ?? ""),
        })),
      })
    }

    if (scoped.courseId != null) {
      const rows = await fetchInstructorStudentsBySessionCode(
        scoped.courseId,
        sectionRaw,
        scope.academicTermId,
      )
      return NextResponse.json({
        students: (rows as Record<string, unknown>[]).map((r) => ({
          studentId: Number(r.id),
          fullName: String(r.full_name ?? ""),
          studentNumber: String(r.student_id ?? ""),
          section: String(r.section ?? r.session_code ?? ""),
        })),
      })
    }

    const rows = await sql`
      SELECT DISTINCT ON (s.id)
        s.id AS student_id,
        s.full_name,
        s.student_id AS student_number,
        COALESCE(NULLIF(TRIM(s.section), ''), TRIM(sess.code)) AS section
      FROM students s
      INNER JOIN sessions sess ON s.session_id = sess.id
      WHERE (
          TRIM(sess.code) = ANY(${variants}::text[])
          OR TRIM(s.section) = ANY(${variants}::text[])
        )
      ORDER BY s.id, s.full_name ASC
    `

    return NextResponse.json({
      students: (rows as Record<string, unknown>[]).map((r) => ({
        studentId: Number(r.student_id),
        fullName: String(r.full_name ?? ""),
        studentNumber: String(r.student_number ?? ""),
        section: String(r.section ?? ""),
      })),
    })
  } catch (e) {
    console.error("[attendance-roster]", e)
    return NextResponse.json({ error: "Failed to load roster" }, { status: 500 })
  }
}
