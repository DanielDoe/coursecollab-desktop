import { sql } from "@/lib/db"
import { rosterAccountRequestIsInCourse } from "@/lib/instructor-roster-account-request-scope"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"

export type ResolvedStudentScope = {
  courseId: number | null
  sessionId: number | null
  sectionCode: string | null
  universityId: number | null
}

/** Resolve course/section scope from a section code string (never trust client courseId alone). */
export async function resolveStudentScopeFromSection(
  section: string,
  universityId?: number | null,
  expectedCourseId?: number | null,
): Promise<ResolvedStudentScope | null> {
  const courseId =
    expectedCourseId != null && Number.isFinite(Number(expectedCourseId))
      ? Math.trunc(Number(expectedCourseId))
      : null
  const resolved = await resolveSessionRowByCode(String(section ?? "").trim(), courseId)
  if (!resolved) return null

  const [sess] = (await sql`
    SELECT s.id, s.code, s.course_id, c.university_id
    FROM sessions s
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${resolved.id}
    LIMIT 1
  `) as Array<{ id: number; code: string; course_id: number; university_id: number | null }>

  if (!sess) return null

  if (courseId != null && sess.course_id !== courseId) return null

  const resolvedUniversityId = sess.university_id ?? null
  if (universityId != null && resolvedUniversityId != null && Number(resolvedUniversityId) !== Number(universityId)) {
    return null
  }

  return {
    courseId: sess.course_id,
    sessionId: sess.id,
    sectionCode: sess.code,
    universityId: universityId ?? resolvedUniversityId ?? null,
  }
}

/** Verify faculty reviewer has authority over a student roster request. */
export async function facultyScopeMatchesStudentRequest(
  platformCourseId: number,
  request: { section?: string | null; course_id?: number | null; session_id?: number | null },
): Promise<boolean> {
  if (request.course_id != null) {
    return request.course_id === platformCourseId
  }
  return rosterAccountRequestIsInCourse(platformCourseId, request.section)
}

/** Verify faculty owns the camp or is assigned as training faculty. */
export async function facultyManagesCamp(
  instructorId: number,
  campId: number,
): Promise<boolean> {
  const rows = (await sql`
    SELECT 1
    FROM summer_camps sc
    WHERE sc.id = ${campId}
      AND sc.instructor_id = ${instructorId}
    LIMIT 1
  `) as unknown[]
  if (rows.length > 0) return true
  const assigned = (await sql`
    SELECT 1
    FROM camp_training_faculty ctf
    INNER JOIN camp_trainings ct ON ct.id = ctf.training_id
    WHERE ct.camp_id = ${campId}
      AND ctf.instructor_id = ${instructorId}
    LIMIT 1
  `) as unknown[]
  return assigned.length > 0
}
