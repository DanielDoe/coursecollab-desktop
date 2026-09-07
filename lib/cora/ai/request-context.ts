import { AsyncLocalStorage } from "async_hooks"
import { type NextRequest, NextResponse } from "next/server"
import { requireStudentApiAuth } from "@/lib/require-student-api-auth"
import { requireAdminId } from "@/lib/admin-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import type { CoraUsageContext, CoraUserRole } from "@/lib/cora/ai/types"

const usageAls = new AsyncLocalStorage<CoraUsageContext>()

export function getCoraUsageContext(): CoraUsageContext | undefined {
  return usageAls.getStore()
}

export function runWithCoraUsageContext<T>(ctx: CoraUsageContext, fn: () => Promise<T>): Promise<T> {
  return usageAls.run(ctx, fn)
}

/** Resolve authenticated actor from server session — never trust query userId or role headers. */
export async function resolveAuthenticatedCoraActor(
  request: NextRequest,
  requestedRole?: string | null,
): Promise<
  | { ok: true; userId: number; userRole: CoraUserRole }
  | { ok: false; response: NextResponse }
> {
  const roleHint =
    requestedRole === "faculty"
      ? "instructor"
      : requestedRole === "student" || requestedRole === "instructor" || requestedRole === "admin"
        ? requestedRole
        : null

  if (roleHint === "admin") {
    const adminCheck = await requireAdminId(request)
    if (!adminCheck.ok) return { ok: false, response: adminCheck.response }
    return { ok: true, userId: Number(adminCheck.adminId), userRole: "admin" }
  }

  if (roleHint === "instructor") {
    const faculty = await requireInstructorSession(request)
    if (!faculty.ok) return { ok: false, response: faculty.response }
    return { ok: true, userId: faculty.instructorId, userRole: "instructor" }
  }

  if (roleHint === "student") {
    const studentAuth = await requireStudentApiAuth(request)
    if (studentAuth instanceof NextResponse) return { ok: false, response: studentAuth }
    return { ok: true, userId: studentAuth.studentDbId, userRole: "student" }
  }

  const admin = await requireAdminId(request)
  if (admin.ok) {
    return { ok: true, userId: Number(admin.adminId), userRole: "admin" }
  }

  const faculty = await requireInstructorSession(request)
  if (faculty.ok) {
    return { ok: true, userId: faculty.instructorId, userRole: "instructor" }
  }

  const studentAuth = await requireStudentApiAuth(request)
  if (studentAuth instanceof NextResponse) {
    return { ok: false, response: studentAuth }
  }
  return { ok: true, userId: studentAuth.studentDbId, userRole: "student" }
}
