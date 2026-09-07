import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const instructorIdRaw = request.headers.get("x-instructor-id")
    if (!instructorIdRaw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const instructorId = Number(instructorIdRaw)
    const actor = await loadInstructorActor(instructorId)
    if (!actor || actor.role === "ta") {
      return NextResponse.json({ error: "Instructor access required" }, { status: 403 })
    }

    const courseIdRaw = request.headers.get("x-course-id")
    const courseId = courseIdRaw ? Number(courseIdRaw) : null
    const filterByCourse = Number.isFinite(courseId) && courseId! > 0

    const rows = filterByCourse
      ? await sql`
          SELECT i.id, i.username, i.email, i.name,
                 COALESCE(i.is_active, true) AS is_active,
                 i.ta_permissions
          FROM instructors i
          INNER JOIN course_staff cs ON cs.instructor_id = i.id
            AND cs.course_id = ${courseId}
            AND cs.is_active = true
          INNER JOIN courses c ON c.id = cs.course_id
            AND c.instructor_id = ${instructorId}
            AND c.is_active = true
          WHERE COALESCE(i.role, 'instructor') = 'ta'
            AND i.assigned_instructor_id = ${instructorId}
          ORDER BY i.name ASC, i.id ASC
        `
      : await sql`
          SELECT id, username, email, name,
                 COALESCE(is_active, true) AS is_active,
                 ta_permissions
          FROM instructors
          WHERE COALESCE(role, 'instructor') = 'ta'
            AND assigned_instructor_id = ${instructorId}
          ORDER BY name ASC, id ASC
        `

    return NextResponse.json({ tas: rows })
  } catch (error) {
    console.error("[instructor/tas GET]", error)
    return NextResponse.json({ error: "Failed to load TAs" }, { status: 500 })
  }
}
