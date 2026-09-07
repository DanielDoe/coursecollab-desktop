import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildLectureInstructorCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"

/** Soft-delete a lecture the instructor can see in GET /api/instructor/lectures. */
export async function softDeleteInstructorOwnedLecture(
  request: NextRequest,
  lectureId: number,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return { ok: false, response: scope.response }

  if (!Number.isFinite(lectureId) || lectureId <= 0) {
    return { ok: false, response: NextResponse.json({ error: "Invalid lecture id" }, { status: 400 }) }
  }

  const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
  const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
    scope.course.id,
    scope.instructorId,
    scope.course.course_code,
    selectedSessionCode,
  )

  const touched = await sql`
    UPDATE lectures l
    SET deleted_at = NOW()
    WHERE l.id = ${lectureId}
      AND l.deleted_at IS NULL
      AND (${scopeWhere})
    RETURNING l.id
  `
  if (touched.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Lecture not found" }, { status: 404 }),
    }
  }
  return { ok: true }
}
