import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"

export function instructorIdFromGroupsRequest(request: NextRequest): number | null {
  const raw = request.headers.get("x-instructor-id")?.trim()
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function adminIdFromGroupsRequest(request: NextRequest): string | null {
  const raw = request.headers.get("x-admin-id")?.trim()
  return raw || null
}

export async function studentDbIdFromGroupsRequest(request: NextRequest): Promise<number | null> {
  const raw =
    request.headers.get("x-student-id")?.trim() ||
    new URL(request.url).searchParams.get("studentId")?.trim() ||
    new URL(request.url).searchParams.get("studentDatabaseId")?.trim()
  if (!raw) return null
  return resolveStudentDatabaseIdFromParam(raw)
}

export async function instructorCanAccessGroup(
  instructorId: number,
  group: { course_id?: unknown; session?: unknown },
): Promise<boolean> {
  const courseId = Number(group.course_id)
  if (Number.isFinite(courseId) && courseId > 0) {
    return instructorCanAccessCourse(instructorId, courseId)
  }
  const session = typeof group.session === "string" ? group.session.trim() : ""
  if (!session) return false
  const rows = await sql`
    SELECT course_id FROM sessions
    WHERE TRIM(code) = ${session} AND course_id IS NOT NULL
    LIMIT 1
  `
  const fromSession = Number(rows[0]?.course_id)
  if (!Number.isFinite(fromSession) || fromSession <= 0) return false
  return instructorCanAccessCourse(instructorId, fromSession)
}

export async function studentCanAccessGroup(
  studentDbId: number,
  group: { course_id?: unknown; session?: unknown },
): Promise<boolean> {
  const ctx = await resolveStudentCourseContextByDbId(studentDbId)
  if (!ctx) return false
  const courseId = Number(group.course_id)
  if (Number.isFinite(courseId) && courseId > 0) {
    return ctx.courseId === courseId
  }
  const session = typeof group.session === "string" ? group.session.trim() : ""
  if (!session) return false
  const rows = await sql`
    SELECT course_id FROM sessions
    WHERE TRIM(code) = ${session} AND course_id IS NOT NULL
    LIMIT 1
  `
  const fromSession = Number(rows[0]?.course_id)
  if (!Number.isFinite(fromSession) || fromSession <= 0) return false
  return ctx.courseId === fromSession
}

function forbiddenGroupResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function requireInstructorGroupAccess(
  request: NextRequest,
  group: { course_id?: unknown; session?: unknown },
): Promise<{ ok: true; instructorId: number } | { ok: false; response: NextResponse }> {
  const session = await requireInstructorSession(request)
  if (!session.ok) return session
  const allowed = await instructorCanAccessGroup(session.instructorId, group)
  if (!allowed) {
    return { ok: false, response: forbiddenGroupResponse() }
  }
  return { ok: true, instructorId: session.instructorId }
}

export async function requireGroupReadAccess(
  request: NextRequest,
  group: { course_id?: unknown; session?: unknown; created_by?: unknown },
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const studentHeader = request.headers.get("x-student-id")?.trim()
  if (studentHeader) {
    const bound = await requireBoundStudentCaller(request, studentHeader)
    if (!bound.ok) return bound
    const allowed = await studentCanAccessGroup(bound.studentDbId, group)
    if (!allowed) return { ok: false, response: forbiddenGroupResponse() }
    return { ok: true }
  }

  const instructorHeader = request.headers.get("x-instructor-id")?.trim()
  if (instructorHeader) {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session
    const allowed = await instructorCanAccessGroup(session.instructorId, group)
    if (!allowed) return { ok: false, response: forbiddenGroupResponse() }
    return { ok: true }
  }

  const studentSession = await requireCallerStudentDbId(request)
  if (studentSession.ok) {
    const allowed = await studentCanAccessGroup(studentSession.studentDbId, group)
    if (!allowed) return { ok: false, response: forbiddenGroupResponse() }
    return { ok: true }
  }

  const instructorSession = await requireInstructorSession(request)
  if (instructorSession.ok) {
    const allowed = await instructorCanAccessGroup(instructorSession.instructorId, group)
    if (!allowed) return { ok: false, response: forbiddenGroupResponse() }
    return { ok: true }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Student or instructor authentication required" }, { status: 401 }),
  }
}
