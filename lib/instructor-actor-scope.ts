import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { ensureTaPermissionColumns } from "@/lib/ensure-ta-permissions-columns"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import type { ScopedCourseRow } from "@/lib/instructor-course-scope"

export type ActorRow = {
  id: number
  role: string
  assigned_instructor_id: number | null
  is_active: boolean
}

export async function loadInstructorActor(actorId: number): Promise<ActorRow | null> {
  await ensureInstructorRoleColumns()
  await ensureTaPermissionColumns()
  const rows = await sql`
    SELECT id, COALESCE(role, 'instructor') AS role, assigned_instructor_id,
           COALESCE(is_active, true) AS is_active
    FROM instructors WHERE id = ${actorId} LIMIT 1
  `
  if (rows.length === 0) return null
  return rows[0] as ActorRow
}

/** Course owner id for scope: instructor owns course; TA uses supervisor's courses */
export function courseOwnerIdForActor(actor: ActorRow): number {
  return actor.role === "ta" && actor.assigned_instructor_id != null
    ? actor.assigned_instructor_id
    : actor.id
}

/** Resolve assessment owner id for legacy list APIs (no course header). */
export async function assessmentListCreatorIdForActor(actorId: number): Promise<number> {
  const actor = await loadInstructorActor(actorId)
  if (!actor) return actorId
  return courseOwnerIdForActor(actor)
}

/** True when an instructor or TA has an active course_staff row for the course. */
export async function actorHasActiveCourseStaff(actorId: number, courseId: number): Promise<boolean> {
  await ensurePortalRbacSchema()
  const staff = await sql`
    SELECT 1 FROM course_staff
    WHERE course_id = ${courseId}
      AND instructor_id = ${actorId}
      AND is_active = true
    LIMIT 1
  `
  return staff.length > 0
}

/** @deprecated Use {@link actorHasActiveCourseStaff} */
export async function taHasActiveCourseStaff(actorId: number, courseId: number): Promise<boolean> {
  return actorHasActiveCourseStaff(actorId, courseId)
}

export async function requireInstructorOrTaCourse(
  request: NextRequest,
): Promise<
  | {
      ok: true
      course: ScopedCourseRow
      actorId: number
      actor: ActorRow
      courseOwnerId: number
    }
  | { ok: false; response: NextResponse }
> {
  const actorIdRaw = request.headers.get("x-instructor-id")
  const courseIdRaw = request.headers.get("x-course-id")
  if (!actorIdRaw) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!courseIdRaw) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Select a course to continue (missing x-course-id)." }, { status: 400 }),
    }
  }
  const actorId = Number(actorIdRaw)
  const courseId = Number(courseIdRaw)
  if (!Number.isFinite(actorId) || !Number.isFinite(courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid course scope" }, { status: 400 }) }
  }

  const actor = await loadInstructorActor(actorId)
  if (!actor || !actor.is_active) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const ownerId = courseOwnerIdForActor(actor)

  const rows = await sql`
    SELECT id, instructor_id, module_settings, course_code, course_title, is_active
    FROM courses
    WHERE id = ${courseId} AND is_active = true
    LIMIT 1
  `
  if (rows.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
  }
  const course = rows[0] as ScopedCourseRow
  const allowed = await actorCanAccessCourse(actorId, actor, course)
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, course, actorId, actor, courseOwnerId: ownerId }
}

/** Owner, co-instructor (course_staff), or assigned TA for a course. */
export async function actorCanAccessCourse(
  actorId: number,
  actor: ActorRow,
  course: { id: number; instructor_id: number },
): Promise<boolean> {
  const ownerId = courseOwnerIdForActor(actor)
  const isCourseOwner = Number(course.instructor_id) === ownerId
  if (actor.role === "ta") {
    return actorHasActiveCourseStaff(actorId, course.id)
  }
  if (isCourseOwner) return true
  return actorHasActiveCourseStaff(actorId, course.id)
}

/** Whether an instructor or assigned TA may view/create announcements for a course. */
export async function instructorCanAccessCourse(
  actorId: number,
  courseId: number,
): Promise<boolean> {
  const actor = await loadInstructorActor(actorId)
  if (!actor || !actor.is_active) return false

  const rows = await sql`
    SELECT instructor_id FROM courses
    WHERE id = ${courseId} AND is_active = true
    LIMIT 1
  `
  if (rows.length === 0) return false

  return actorCanAccessCourse(actorId, actor, {
    id: courseId,
    instructor_id: Number(rows[0].instructor_id),
  })
}
