import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sectionFilterCodesForSql } from "@/lib/session-code-aliases"
import { isLegacyLoginRequest, requireStudentApiAuth } from "@/lib/require-student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLegacyLoginRequest(request)) {
      const auth = await requireStudentApiAuth(request)
      if (auth instanceof NextResponse) return auth
    }

    const { id } = await params
    const sessionId = Number.parseInt(id)
    const courseIdRaw = new URL(request.url).searchParams.get("courseId")
    const courseId = courseIdRaw ? Number(courseIdRaw) : null

    const sess = await sql`
      SELECT code, course_id FROM sessions WHERE id = ${sessionId}
    `
    if (sess.length === 0) {
      return NextResponse.json({ students: [] })
    }

    if (courseId != null && Number.isFinite(courseId)) {
      const sidC = sess[0].course_id != null ? Number(sess[0].course_id) : null
      if (sidC !== courseId) {
        return NextResponse.json({ error: "Section does not belong to selected course" }, { status: 403 })
      }
    }
    const variants = sectionFilterCodesForSql(String(sess[0].code ?? ""))

    const students =
      variants.length > 0
        ? await sql`
            SELECT s.id, s.student_id, s.full_name
            FROM students s
            WHERE s.session_id = ${sessionId}
               OR s.section = ANY(${variants}::text[])
            ORDER BY s.full_name ASC
          `
        : await sql`
            SELECT id, student_id, full_name
            FROM students
            WHERE session_id = ${sessionId}
            ORDER BY full_name ASC
          `

    return NextResponse.json({ students })
  } catch (error) {
    console.error("[v0] Failed to fetch students:", error)
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}
