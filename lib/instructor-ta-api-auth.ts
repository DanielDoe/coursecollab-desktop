import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { requireInstructorFeature } from "@/lib/instructor-membership-guard"

export async function requireInstructorTaManager(request: NextRequest) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  const actor = await loadInstructorActor(instructorId)
  if (!actor || actor.role === "ta") {
    return { ok: false as const, response: NextResponse.json({ error: "Instructor access required" }, { status: 403 }) }
  }
  return { ok: true as const, instructorId, actor }
}

/** Instructor owner + Teams `teachingAssistantManagement`. */
export async function requireInstructorTaManagement(request: NextRequest) {
  const auth = await requireInstructorTaManager(request)
  if (!auth.ok) return auth

  const feature = await requireInstructorFeature(
    auth.instructorId,
    "teachingAssistantManagement",
    "Teaching assistant management requires Instructor Teams.",
  )
  if (!feature.ok) return feature

  if (!(await canInstructorManageTas(auth.instructorId))) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "You do not have permission to manage teaching assistants" },
        { status: 403 },
      ),
    }
  }

  return auth
}

export async function assertInstructorOwnsCourse(instructorId: number, courseId: number) {
  const course = await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND instructor_id = ${instructorId} AND is_active = true LIMIT 1
  `
  return course.length > 0
}

export async function loadSupervisedTa(taId: number, supervisorId: number) {
  const rows = await sql`
    SELECT id, username, email, name,
           COALESCE(is_active, true) AS is_active,
           ta_permissions
    FROM instructors
    WHERE id = ${taId}
      AND COALESCE(role, 'instructor') = 'ta'
      AND assigned_instructor_id = ${supervisorId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  return rows[0] as {
    id: number
    username: string
    email: string
    name: string
    is_active: boolean
    ta_permissions: unknown
  }
}

/** Instructor account owner or course owner gets manage_tas implicitly via full course permissions. */
export async function canInstructorManageTas(instructorId: number, courseId?: number | null): Promise<boolean> {
  if (courseId != null && Number.isFinite(courseId)) {
    const owned = await assertInstructorOwnsCourse(instructorId, courseId)
    if (owned) return true
    const perms = await getUserCoursePermissions(instructorId, courseId)
    return perms.permissions.includes("manage_tas")
  }
  const rows = await sql`
    SELECT id FROM courses WHERE instructor_id = ${instructorId} AND is_active = true LIMIT 1
  `
  return rows.length > 0
}
