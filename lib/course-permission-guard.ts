import { type NextRequest, NextResponse } from "next/server"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { hasAnyPermission } from "@/lib/permission-utils"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { requireInstructorCourse, type ScopedCourseRow } from "@/lib/instructor-course-scope"

export async function getActorCoursePermissionCodes(
  request: NextRequest,
): Promise<
  | { ok: true; permissions: string[]; instructorId: number; course: ScopedCourseRow; isInstructorOwner: boolean }
  | { ok: false; response: NextResponse }
> {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return { ok: false, response: scope.response }

  const actor = await loadInstructorActor(scope.instructorId)
  if (!actor || !actor.is_active) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const isInstructorOwner = actor.role !== "ta"
  const { permissions } = await getUserCoursePermissions(scope.instructorId, scope.course.id)

  return {
    ok: true,
    permissions,
    instructorId: scope.instructorId,
    course: scope.course,
    isInstructorOwner,
  }
}

export function coursePermitted(permissions: string[], anyOf: string[]): boolean {
  if (anyOf.length === 0) return true
  return hasAnyPermission(permissions, anyOf)
}

export async function requireCoursePermission(
  request: NextRequest,
  anyOf: string[],
  message = "You do not have permission for this action in the selected course.",
): Promise<
  | { ok: true; permissions: string[]; instructorId: number; course: ScopedCourseRow; isInstructorOwner: boolean }
  | { ok: false; response: NextResponse }
> {
  const ctx = await getActorCoursePermissionCodes(request)
  if (!ctx.ok) return ctx
  if (ctx.isInstructorOwner) return ctx
  if (!coursePermitted(ctx.permissions, anyOf)) {
    return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) }
  }
  return ctx
}
