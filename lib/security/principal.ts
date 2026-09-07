import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export type SecurityRole = "student" | "faculty" | "admin"

export type AuthenticatedPrincipal =
  | { role: "student"; userId: number }
  | { role: "faculty"; userId: number }
  | { role: "admin"; userId: number }

function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 })
}

function forbidden(message = "Access denied") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function requireStudent(request: NextRequest) {
  return requireCallerStudentDbId(request)
}

export async function requireFaculty(request: NextRequest) {
  return requireInstructorSession(request)
}

export async function requireAdmin(request: NextRequest) {
  return requireAdminId(request)
}

export async function requireCourseOwnership(request: NextRequest) {
  return requireInstructorCourse(request)
}

export async function requireAuthenticatedUser(
  request: NextRequest,
): Promise<{ ok: true; principal: AuthenticatedPrincipal } | { ok: false; response: NextResponse }> {
  const admin = await requireAdminId(request)
  if (admin.ok) {
    return { ok: true, principal: { role: "admin", userId: Number(admin.adminId) } }
  }

  const faculty = await requireInstructorSession(request)
  if (faculty.ok) {
    return { ok: true, principal: { role: "faculty", userId: faculty.instructorId } }
  }

  const student = await requireCallerStudentDbId(request)
  if (student.ok) {
    return { ok: true, principal: { role: "student", userId: student.studentDbId } }
  }

  return { ok: false, response: unauthorized() }
}

export async function requireAdminOrFaculty(
  request: NextRequest,
): Promise<
  | { ok: true; role: "admin" | "faculty"; userId: number }
  | { ok: false; response: NextResponse }
> {
  const admin = await requireAdminId(request)
  if (admin.ok) {
    return { ok: true, role: "admin", userId: Number(admin.adminId) }
  }
  const faculty = await requireInstructorSession(request)
  if (faculty.ok) {
    return { ok: true, role: "faculty", userId: faculty.instructorId }
  }
  return { ok: false, response: unauthorized() }
}

export async function requireRole(
  request: NextRequest,
  role: SecurityRole,
): Promise<{ ok: true; userId: number } | { ok: false; response: NextResponse }> {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth
  if (auth.principal.role !== role) {
    return { ok: false, response: forbidden() }
  }
  return { ok: true, userId: auth.principal.userId }
}

export { unauthorized as unauthorizedSecurityResponse, forbidden as forbiddenSecurityResponse }
