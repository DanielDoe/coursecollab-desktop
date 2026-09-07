import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { formatAcademicTermLabel, getActiveAcademicTerm } from "@/lib/active-academic-term"
import { isLegacyLoginRequest, requireStudentApiAuth } from "@/lib/require-student-api-auth"

export const dynamic = "force-dynamic"

/** Active courses — authenticated students only (legacy login header for deprecated form). */
export async function GET(request: NextRequest) {
  try {
    if (!isLegacyLoginRequest(request)) {
      const auth = await requireStudentApiAuth(request)
      if (auth instanceof NextResponse) return auth
    }
    const activeTerm = await getActiveAcademicTerm()
    if (!activeTerm) {
      return NextResponse.json({ courses: [], activeTerm: null })
    }

    const rows = await sql`
      SELECT DISTINCT
        c.id,
        c.course_code,
        c.course_title,
        c.university,
        COALESCE(c.semester, ${formatAcademicTermLabel(activeTerm.year, activeTerm.term)}) AS semester
      FROM courses c
      INNER JOIN academic_term_courses atc ON atc.course_id = c.id AND atc.academic_term_id = ${activeTerm.id}
      WHERE c.is_active = true
      ORDER BY c.course_title ASC, c.id ASC
    `
    return NextResponse.json({
      courses: rows,
      activeTerm: {
        id: activeTerm.id,
        label: formatAcademicTermLabel(activeTerm.year, activeTerm.term),
      },
    })
  } catch (error) {
    console.error("[student/courses]", error)
    return NextResponse.json({ error: "Failed to load courses", courses: [] }, { status: 500 })
  }
}
