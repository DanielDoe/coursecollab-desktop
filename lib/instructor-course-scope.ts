import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  actorCanAccessCourse,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  courseRowMatchesUniversity,
  parseUniversityIdFromRequest,
} from "@/lib/instructor-university-scope"

export type ScopedCourseRow = {
  id: number
  instructor_id: number
  module_settings: unknown
  course_code: string
  course_title: string
  is_active: boolean
}

export async function requireInstructorCourse(
  request: NextRequest,
): Promise<{ ok: true; course: ScopedCourseRow; instructorId: number } | { ok: false; response: NextResponse }> {
  const session = await requireInstructorSession(request)
  if (!session.ok) return session

  const instructorId = session.instructorId
  const courseIdRaw = request.headers.get("x-course-id")
  if (!courseIdRaw) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Select a course to continue (missing x-course-id)." }, { status: 400 }),
    }
  }
  const courseId = Number(courseIdRaw)
  if (!Number.isFinite(instructorId) || !Number.isFinite(courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid course scope" }, { status: 400 }) }
  }

  const rows = await sql`
    SELECT id, instructor_id, module_settings, course_code, course_title, is_active, university_id, university
    FROM courses
    WHERE id = ${courseId} AND is_active = true
    LIMIT 1
  `
  if (rows.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
  }
  const course = rows[0] as ScopedCourseRow & { university_id?: number | null; university?: string | null }

  const universityId = parseUniversityIdFromRequest(request)
  if (
    universityId != null &&
    !courseRowMatchesUniversity(
      {
        university_id: course.university_id ?? null,
        course_code: course.course_code,
        university: course.university ?? null,
      },
      universityId,
    )
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This course belongs to a different university. Switch campus or sign in with the matching faculty account." },
        { status: 403 },
      ),
    }
  }

  const actor = await loadInstructorActor(instructorId)
  if (!actor || !actor.is_active) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const allowed = await actorCanAccessCourse(instructorId, actor, course)
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, course, instructorId }
}

/**
 * When both scope headers are present, validates like {@link requireInstructorCourse}.
 * When both are absent, returns `none` (e.g. student-facing requests).
 * Partial headers → 400.
 */
export async function tryResolveInstructorCourseScope(request: NextRequest): Promise<
  | { ok: true; course: ScopedCourseRow; instructorId: number }
  | { ok: false; reason: "none" }
  | { ok: false; reason: "invalid"; response: NextResponse }
> {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  const courseIdRaw = request.headers.get("x-course-id")
  if (!instructorIdRaw?.trim() && !courseIdRaw?.trim()) {
    return { ok: false, reason: "none" }
  }
  const session = await requireInstructorSession(request)
  if (!session.ok) {
    return { ok: false, reason: "invalid", response: session.response }
  }
  if (!instructorIdRaw?.trim() || !courseIdRaw?.trim()) {
    return {
      ok: false,
      reason: "invalid",
      response: NextResponse.json(
        { error: "Course-scoped instructor requests require both x-instructor-id and x-course-id." },
        { status: 400 },
      ),
    }
  }
  const instructorId = session.instructorId
  const courseId = Number(courseIdRaw)
  if (!Number.isFinite(instructorId) || !Number.isFinite(courseId)) {
    return {
      ok: false,
      reason: "invalid",
      response: NextResponse.json({ error: "Invalid course scope" }, { status: 400 }),
    }
  }
  const rows = await sql`
    SELECT id, instructor_id, module_settings, course_code, course_title, is_active
    FROM courses
    WHERE id = ${courseId} AND is_active = true
    LIMIT 1
  `
  if (rows.length === 0) {
    return {
      ok: false,
      reason: "invalid",
      response: NextResponse.json({ error: "Course not found" }, { status: 404 }),
    }
  }
  const course = rows[0] as ScopedCourseRow
  const actor = await loadInstructorActor(instructorId)
  if (!actor || !actor.is_active) {
    return {
      ok: false,
      reason: "invalid",
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  const allowed = await actorCanAccessCourse(instructorId, actor, course)
  if (!allowed) {
    return {
      ok: false,
      reason: "invalid",
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { ok: true, course, instructorId }
}

export async function studentBelongsToCourse(studentId: number, courseId: number): Promise<boolean> {
  if (!Number.isFinite(studentId) || !Number.isFinite(courseId) || studentId <= 0 || courseId <= 0) {
    return false
  }
  const rows = await sql`
    SELECT 1
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId}
      AND (
        s.course_id = ${courseId}
        OR sess.course_id = ${courseId}
      )
    LIMIT 1
  `
  return rows.length > 0
}

/** Student/login: verify course exists and is active (no instructor header). */
export async function requireActiveCourse(courseId: number): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  if (!Number.isFinite(courseId)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid course" }, { status: 400 }) }
  }
  const rows = await sql`
    SELECT 1 FROM courses WHERE id = ${courseId} AND is_active = true LIMIT 1
  `
  if (rows.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Course not found" }, { status: 404 }) }
  }
  return { ok: true }
}
