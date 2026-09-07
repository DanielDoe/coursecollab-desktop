import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { provisionFacultyInstructorCourseAccess } from "@/lib/provision-faculty-course-access"

export const dynamic = "force-dynamic"

/** Assign or clear primary course owner (instructor_id). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()

    const { id: idParam } = await params
    const courseId = Number(idParam)
    if (!Number.isFinite(courseId)) {
      return NextResponse.json({ error: "Invalid course id" }, { status: 400 })
    }

    const body = await request.json()
    const instructorId =
      body.instructor_id == null || body.instructor_id === ""
        ? null
        : Number(body.instructor_id)

    if (instructorId != null && !Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Invalid instructor id" }, { status: 400 })
    }

    if (instructorId != null) {
      const inst = await sql`
        SELECT id FROM instructors
        WHERE id = ${instructorId}
          AND COALESCE(role, 'instructor') IN ('instructor', 'department_admin')
        LIMIT 1
      `
      if (inst.length === 0) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
      }
    }

    const updated = await sql`
      UPDATE courses
      SET instructor_id = ${instructorId}, updated_at = NOW()
      WHERE id = ${courseId}
      RETURNING id, course_code, course_title, instructor_id
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    if (instructorId != null) {
      await provisionFacultyInstructorCourseAccess(instructorId, courseId, null)
    }

    const instructor =
      instructorId != null
        ? await sql`
            SELECT name, username FROM instructors WHERE id = ${instructorId} LIMIT 1
          `
        : []

    return NextResponse.json({
      course: {
        ...updated[0],
        instructor_name: instructor[0]?.name ?? null,
        instructor_username: instructor[0]?.username ?? null,
      },
    })
  } catch (error) {
    console.error("[admin/courses PATCH]", error)
    return NextResponse.json({ error: "Failed to update course assignment" }, { status: 500 })
  }
}
