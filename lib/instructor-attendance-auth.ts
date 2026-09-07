import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { hasAnyPermission } from "@/lib/permission-utils"
import {
  actorCanAccessCourse,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"
import { instructorOwnsSectionVariants } from "@/lib/instructor-section-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export const ATTENDANCE_ACCESS_PERMISSIONS = [
  "take_attendance",
  "manage_attendance",
] as const

export function hasAttendanceAccess(permissions: string[]): boolean {
  return hasAnyPermission(permissions, [...ATTENDANCE_ACCESS_PERMISSIONS])
}

/**
 * Faculty / instructor / TA attendance APIs.
 * Identity comes from `requireInstructorSession`. `x-instructor-id` / `x-admin-id` are claims only.
 * TAs need course_staff + take_attendance or manage_attendance.
 */
export async function requireInstructorAttendanceAccess(
  request: NextRequest,
): Promise<
  | { ok: true; actorId: number; courseId: number | null; permissions: string[] }
  | { ok: false; response: NextResponse }
> {
  const session = await requireInstructorSession(request)
  if (!session.ok) return session

  const actorId = session.instructorId

  const actor = await loadInstructorActor(actorId)
  if (!actor || !actor.is_active) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const headerCourseRaw = request.headers.get("x-course-id")
  const courseId =
    headerCourseRaw != null && headerCourseRaw.trim() !== "" ? Number(headerCourseRaw) : null

  if (courseId != null && Number.isFinite(courseId)) {
    const courseRows = await sql`
      SELECT id, instructor_id FROM courses
      WHERE id = ${courseId} AND is_active = true
      LIMIT 1
    `
    if (courseRows.length === 0) {
      return { ok: false, response: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
    }
    const courseRow = courseRows[0] as { id: number; instructor_id: number }
    const allowed = await actorCanAccessCourse(actorId, actor, {
      id: courseRow.id,
      instructor_id: Number(courseRow.instructor_id),
    })
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }

    const { permissions, staffRole } = await getUserCoursePermissions(actorId, courseId)
    const isOwner = staffRole === "INSTRUCTOR"
    if (!isOwner && !hasAttendanceAccess(permissions)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "You do not have attendance permission for this course." },
          { status: 403 },
        ),
      }
    }

    return { ok: true, actorId, courseId, permissions }
  }

  if (actor.role === "ta") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Select a course to continue (missing x-course-id)." },
        { status: 400 },
      ),
    }
  }

  return {
    ok: true,
    actorId,
    courseId: null,
    permissions: [...ATTENDANCE_ACCESS_PERMISSIONS],
  }
}

/** True when actor may view/edit a session (own session, course owner, or TA on that course). */
export async function canActorAccessAttendanceSession(
  actorId: number,
  session: { instructor_id: number; section: string },
  courseId?: number | null,
): Promise<boolean> {
  if (Number(session.instructor_id) === actorId) return true

  const variants = normalizedSectionVariantsForSql(String(session.section ?? ""))
  if (variants.length === 0) return false

  return instructorOwnsSectionVariants(actorId, variants, courseId ?? undefined)
}
