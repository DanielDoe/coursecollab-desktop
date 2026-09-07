import { sql } from "@/lib/db"
import type { CourseExchangeModule, CourseExchangeRequestRow } from "@/lib/course-exchange/types"
import { normalizeModuleList } from "@/lib/course-exchange/modules"

export async function assertActiveFaculty(instructorId: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!Number.isFinite(instructorId) || instructorId < 1) {
    return { ok: false, reason: "Invalid instructor." }
  }
  const rows = (await sql`
    SELECT id, is_active FROM instructors WHERE id = ${instructorId} LIMIT 1
  `) as { id: number; is_active: boolean }[]
  if (!rows[0]?.is_active) return { ok: false, reason: "Faculty account is not active." }
  return { ok: true }
}

export async function assertCourseOwner(
  instructorId: number,
  courseId: number,
): Promise<{ ok: true; course: { id: number; instructor_id: number; course_code: string; course_title: string } } | { ok: false; reason: string }> {
  const rows = (await sql`
    SELECT id, instructor_id, course_code, course_title
    FROM courses
    WHERE id = ${courseId} AND is_active = true
    LIMIT 1
  `) as { id: number; instructor_id: number; course_code: string; course_title: string }[]
  const course = rows[0]
  if (!course) return { ok: false, reason: "Course not found." }
  if (Number(course.instructor_id) !== instructorId) {
    return { ok: false, reason: "You do not own this course." }
  }
  return { ok: true, course }
}

export async function assertDestinationOwnedByRequester(
  requesterInstructorId: number,
  destinationCourseId: number,
): Promise<{ ok: true; course: { id: number; course_code: string } } | { ok: false; reason: string }> {
  const owned = await assertCourseOwner(requesterInstructorId, destinationCourseId)
  if (owned.ok) {
    return { ok: true, course: { id: owned.course.id, course_code: owned.course.course_code } }
  }

  const staffRows = (await sql`
    SELECT c.id, c.course_code
    FROM course_staff cs
    INNER JOIN courses c ON c.id = cs.course_id
    WHERE cs.instructor_id = ${requesterInstructorId}
      AND cs.course_id = ${destinationCourseId}
      AND cs.is_active = true
      AND c.is_active = true
    LIMIT 1
  `) as { id: number; course_code: string }[]

  if (staffRows[0]) {
    return { ok: true, course: { id: staffRows[0].id, course_code: staffRows[0].course_code } }
  }

  return owned
}

export function resolveApprovedModules(request: CourseExchangeRequestRow): CourseExchangeModule[] {
  return normalizeModuleList(request.approved_modules ?? [])
}

export function assertModulesSubsetOfApproved(
  approved: CourseExchangeModule[],
  requested: CourseExchangeModule[],
): { ok: true } | { ok: false; reason: string } {
  for (const mod of requested) {
    if (!approved.includes(mod)) {
      return { ok: false, reason: `Module "${mod}" was not approved by the creator.` }
    }
  }
  return { ok: true }
}

export async function loadExchangeRequest(requestId: number): Promise<CourseExchangeRequestRow | null> {
  const rows = (await sql`
    SELECT *
    FROM course_exchange_requests
    WHERE id = ${requestId}
    LIMIT 1
  `) as CourseExchangeRequestRow[]
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    requested_modules: normalizeModuleList(row.requested_modules),
    approved_modules: row.approved_modules ? normalizeModuleList(row.approved_modules) : null,
  }
}

export async function assertCreatorCanReview(
  instructorId: number,
  request: CourseExchangeRequestRow,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (Number(request.source_instructor_id) !== instructorId) {
    return { ok: false, reason: "Only the source course creator can review this request." }
  }
  if (request.status !== "PENDING") {
    return { ok: false, reason: `Request is already ${request.status.toLowerCase()}.` }
  }
  return { ok: true }
}

export async function assertRequesterCanImport(
  instructorId: number,
  request: CourseExchangeRequestRow,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (Number(request.requester_instructor_id) !== instructorId) {
    return { ok: false, reason: "Only the requester can import approved materials." }
  }
  if (request.status !== "APPROVED" && request.status !== "FAILED") {
    if (request.status === "COMPLETED") {
      return { ok: false, reason: "Materials were already imported for this request." }
    }
    if (request.status === "COPYING") {
      return { ok: false, reason: "Import is already in progress." }
    }
    return { ok: false, reason: "Request must be approved before import." }
  }
  if (!request.approved_modules || normalizeModuleList(request.approved_modules).length === 0) {
    return { ok: false, reason: "No modules were approved for sharing." }
  }
  return { ok: true }
}
