import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserCoursePermissions } from "@/lib/course-permissions"
import { hasAnyPermission } from "@/lib/permission-utils"
import {
  actorCanAccessCourse,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"
import { requireAdminId } from "@/lib/admin-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

/** Permissions that allow re-evaluate, bulk evaluate, manual override, and AI evaluation queue. */
export const GRADING_ACCESS_PERMISSIONS = [
  "grade_assignments",
  "grade_exams",
  "review_submissions",
  "override_grades",
  "publish_grades",
] as const

export function hasGradingAccess(permissions: string[]): boolean {
  return hasAnyPermission(permissions, [...GRADING_ACCESS_PERMISSIONS])
}

async function resolveCourseIdFromAttemptOrAnswer(
  attemptId?: number,
  answerId?: number,
): Promise<{ courseId: number | null; assessmentType: string | null }> {
  if (answerId != null) {
    const rows = await sql`
      SELECT q.course_id, q.assessment_type
      FROM quiz_answers qa
      JOIN quiz_attempts att ON att.id = qa.attempt_id
      JOIN quizzes q ON q.id = att.quiz_id
      WHERE qa.id = ${answerId}
      LIMIT 1
    `
    if (rows.length > 0) {
      const r = rows[0] as { course_id: number | null; assessment_type: string | null }
      return { courseId: r.course_id != null ? Number(r.course_id) : null, assessmentType: r.assessment_type }
    }
  }
  if (attemptId != null) {
    const rows = await sql`
      SELECT q.course_id, q.assessment_type
      FROM quiz_attempts att
      JOIN quizzes q ON q.id = att.quiz_id
      WHERE att.id = ${attemptId}
      LIMIT 1
    `
    if (rows.length > 0) {
      const r = rows[0] as { course_id: number | null; assessment_type: string | null }
      return { courseId: r.course_id != null ? Number(r.course_id) : null, assessmentType: r.assessment_type }
    }
  }
  return { courseId: null, assessmentType: null }
}

/**
 * Faculty / instructor / TA grading APIs (re-evaluate, bulk evaluate, overrides, AI queue).
 * Admins bypass. TAs need course_staff + a grading permission.
 */
export async function requireInstructorGradingAccess(
  request: NextRequest,
  opts?: { attemptId?: number; answerId?: number; evaluationId?: number },
): Promise<
  | {
      ok: true
      actorId: number
      courseId: number | null
      instructorLabel: string
      permissions: string[]
    }
  | { ok: false; response: NextResponse }
> {
  const admin = await requireAdminId(request)
  if (admin.ok) {
    return {
      ok: true,
      actorId: Number(admin.adminId),
      courseId: null,
      instructorLabel: `admin:${admin.adminId}`,
      permissions: [...GRADING_ACCESS_PERMISSIONS],
    }
  }

  const session = await requireInstructorSession(request)
  if (!session.ok) return session
  const actorId = session.instructorId

  const actor = await loadInstructorActor(actorId)
  if (!actor || !actor.is_active) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const headerCourseRaw = request.headers.get("x-course-id")
  let courseId =
    headerCourseRaw != null && headerCourseRaw.trim() !== "" ? Number(headerCourseRaw) : null

  if ((courseId == null || !Number.isFinite(courseId)) && opts?.evaluationId != null) {
    const evRows = await sql`
      SELECT q.course_id
      FROM ai_evaluation_queue aeq
      JOIN quiz_attempts att ON att.id = aeq.attempt_id
      JOIN quizzes q ON q.id = att.quiz_id
      WHERE aeq.id = ${opts.evaluationId}
      LIMIT 1
    `
    if (evRows.length > 0) {
      courseId = Number((evRows[0] as { course_id: number }).course_id)
    }
  }

  if (courseId == null || !Number.isFinite(courseId)) {
    const resolved = await resolveCourseIdFromAttemptOrAnswer(opts?.attemptId, opts?.answerId)
    if (resolved.courseId != null) courseId = resolved.courseId
  }

    if (opts?.attemptId != null && courseId != null && Number.isFinite(courseId)) {
      const attemptCourse = await resolveCourseIdFromAttemptOrAnswer(opts.attemptId)
      if (attemptCourse.courseId != null && attemptCourse.courseId !== courseId) {
        return { ok: false, response: NextResponse.json({ error: "Attempt not found" }, { status: 404 }) }
      }
    }

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
    if (!isOwner && !hasGradingAccess(permissions)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "You do not have grading permission for this course. Ask your instructor to enable grading access." },
          { status: 403 },
        ),
      }
    }

    return {
      ok: true,
      actorId,
      courseId,
      instructorLabel: String(actorId),
      permissions,
    }
  }

  // Legacy: course owner without x-course-id (instructors only — TAs must send course scope)
  const ownerId = courseOwnerIdForActor(actor)
  if (actor.role === "ta") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Select a course to continue (missing x-course-id)." },
        { status: 400 },
      ),
    }
  }

  const ownerCourses = await sql`
    SELECT id FROM courses WHERE instructor_id = ${ownerId} AND is_active = true LIMIT 1
  `
  if (ownerCourses.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    ok: true,
    actorId,
    courseId: null,
    instructorLabel: String(actorId),
    permissions: [...GRADING_ACCESS_PERMISSIONS],
  }
}
