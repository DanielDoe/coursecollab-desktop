import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/classroom-points/export-data
 * Approved classroom points + submission metadata + codebench payload for instructor ZIP/PDF exports.
 * Optional ?session=CODE filters like student-facing session scope.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const session = new URL(request.url).searchParams.get("session")

    // One query per variant — do not nest `sql`...`` in variables: project `sql` is async and returns
    // Promises, which Neon then binds as parameters ("syntax error at or near \"$1\"").
    const points = session
      ? await sql`
          SELECT 
            cp.id,
            cp.student_id,
            cp.points,
            cp.reason,
            cp.category,
            cp.status,
            cp.awarded_at,
            cp.created_at,
            cp.submission_id,
            s.student_id as student_number,
            s.full_name as student_name,
            s.section as student_section,
            cps.title as submission_title,
            cs.code,
            cs.plot_image
          FROM classroom_points cp
          INNER JOIN students s ON s.id = cp.student_id
          LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE (cp.status = 'approved' OR cp.status IS NULL)
            AND s.course_id = ${scope.course.id}
            AND (
              cp.session = ${session}
              OR (cp.session IS NULL AND s.section = ${session})
            )
          ORDER BY s.full_name ASC, COALESCE(cp.awarded_at, cp.created_at) ASC
        `
      : await sql`
          SELECT 
            cp.id,
            cp.student_id,
            cp.points,
            cp.reason,
            cp.category,
            cp.status,
            cp.awarded_at,
            cp.created_at,
            cp.submission_id,
            s.student_id as student_number,
            s.full_name as student_name,
            s.section as student_section,
            cps.title as submission_title,
            cs.code,
            cs.plot_image
          FROM classroom_points cp
          INNER JOIN students s ON s.id = cp.student_id
          LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE (cp.status = 'approved' OR cp.status IS NULL)
            AND s.course_id = ${scope.course.id}
          ORDER BY s.full_name ASC, COALESCE(cp.awarded_at, cp.created_at) ASC
        `

    return NextResponse.json(
      { points },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  } catch (error: unknown) {
    console.error("[instructor/classroom-points/export-data]", error)
    return NextResponse.json({ error: "Failed to load export data" }, { status: 500 })
  }
}
