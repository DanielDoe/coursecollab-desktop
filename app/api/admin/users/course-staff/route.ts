import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { ensurePortalRbacSeed } from "@/lib/ensure-portal-rbac-seed"
import { normalizeCourseStaffRole, type CourseStaffRole } from "@/lib/roles"
import { provisionFacultyInstructorCourseAccess } from "@/lib/provision-faculty-course-access"

export const dynamic = "force-dynamic"

const VALID_STAFF: CourseStaffRole[] = ["INSTRUCTOR", "TA", "COURSE_OBSERVER"]

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()
    await ensurePortalRbacSeed()

    const body = await request.json()
    const instructorId = Number(body.instructorId)
    const courseId = Number(body.courseId)
    const staffRole = normalizeCourseStaffRole(body.staffRole)
    const remove = Boolean(body.remove)

    if (!Number.isFinite(instructorId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "instructorId and courseId required" }, { status: 400 })
    }

    if (remove) {
      await sql`
        UPDATE course_staff SET is_active = false, updated_at = NOW()
        WHERE instructor_id = ${instructorId} AND course_id = ${courseId}
      `
      return NextResponse.json({ success: true })
    }

    if (!staffRole || !VALID_STAFF.includes(staffRole)) {
      return NextResponse.json({ error: "Invalid staff role" }, { status: 400 })
    }

    const course = await sql`SELECT id FROM courses WHERE id = ${courseId} AND is_active = true LIMIT 1`
    if (course.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const staffId =
      staffRole === "INSTRUCTOR"
        ? await provisionFacultyInstructorCourseAccess(instructorId, courseId, null)
        : await (async () => {
            const { ensureCourseStaffRow } = await import("@/lib/course-staff-sync")
            return ensureCourseStaffRow(courseId, instructorId, staffRole, null)
          })()
    return NextResponse.json({ success: true, courseStaffId: staffId })
  } catch (error) {
    console.error("[admin/users/course-staff]", error)
    return NextResponse.json({ error: "Failed to update course assignment" }, { status: 500 })
  }
}
