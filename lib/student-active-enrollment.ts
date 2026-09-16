import { getSQL } from "@/lib/db"
import { formatAcademicTermLabel } from "@/lib/active-academic-term"
import {
  findStudentEnrollmentsAtUniversity,
  type StudentEnrollmentOption,
} from "@/lib/student-university-auth"
import {
  matchStudentEnrollment,
  serializeStudentEnrollment,
  type StudentActiveEnrollmentRequest,
  type StudentEnrollmentRecord,
} from "@/lib/student-active-enrollment-logic"

export type { StudentEnrollmentRecord, StudentActiveEnrollmentRequest }
export { matchStudentEnrollment, serializeStudentEnrollment }

export async function findEnrollmentsForStudentDbId(
  studentDbId: number,
): Promise<StudentEnrollmentRecord[]> {
  const sql = getSQL()
  const rows = (await sql`
    SELECT student_id, university_id, email, sis_login_id
    FROM students
    WHERE id = ${studentDbId} AND deleted_at IS NULL
    LIMIT 1
  `) as Array<{
    student_id: string | null
    university_id: number | null
    email: string | null
    sis_login_id: string | null
  }>
  const row = rows[0]
  if (!row) return []

  const universityId = row.university_id != null ? Number(row.university_id) : null
  const identifier = String(row.student_id ?? row.email ?? row.sis_login_id ?? "").trim()
  if (universityId == null || !Number.isFinite(universityId) || !identifier) return []

  const enrollments = await findStudentEnrollmentsAtUniversity(universityId, identifier)
  return enrichStudentEnrollments(enrollments)
}

async function enrichStudentEnrollments(
  enrollments: StudentEnrollmentOption[],
): Promise<StudentEnrollmentRecord[]> {
  const sessionIds = enrollments
    .map((row) => row.sessionId)
    .filter((id): id is number => id != null && Number.isFinite(id) && id > 0)
  const terms = new Map<number, { academicTermId: number | null; academicTermLabel: string | null }>()

  if (sessionIds.length > 0) {
    const sql = getSQL()
    const termRows = (await sql`
      SELECT sess.id, sess.academic_term_id, t.year, t.term, t.display_name
      FROM sessions sess
      LEFT JOIN academic_terms t ON t.id = sess.academic_term_id
      WHERE sess.id = ANY(${sessionIds})
    `) as Array<{
      id: number
      academic_term_id: number | null
      year: number | null
      term: string | null
      display_name: string | null
    }>
    for (const term of termRows) {
      const displayName = term.display_name?.trim()
      const academicTermLabel =
        displayName ||
        (term.year != null && term.term?.trim()
          ? formatAcademicTermLabel(Number(term.year), String(term.term))
          : null)
      terms.set(Number(term.id), {
        academicTermId: term.academic_term_id != null ? Number(term.academic_term_id) : null,
        academicTermLabel,
      })
    }
  }

  const courseIds = [...new Set(enrollments.map((row) => row.courseId).filter((id) => Number.isFinite(id) && id > 0))]
  const instructors = new Map<number, string>()
  if (courseIds.length > 0) {
    const sql = getSQL()
    const instructorRows = (await sql`
      SELECT c.id, COALESCE(NULLIF(TRIM(i.name), ''), i.username) AS instructor_name
      FROM courses c
      LEFT JOIN instructors i ON i.id = c.instructor_id
      WHERE c.id = ANY(${courseIds})
    `) as Array<{ id: number; instructor_name: string | null }>
    for (const row of instructorRows) {
      const name = row.instructor_name?.trim()
      if (name) instructors.set(Number(row.id), name)
    }
  }

  return enrollments.map((row) => {
    const term = row.sessionId != null ? terms.get(row.sessionId) : undefined
    return {
      ...row,
      academicTermId: term?.academicTermId ?? null,
      academicTermLabel: term?.academicTermLabel ?? null,
      instructorName: instructors.get(row.courseId) ?? null,
      status: "active" as const,
    }
  })
}

export function publicStudentEnrollments(enrollments: StudentEnrollmentRecord[]) {
  return enrollments.map(serializeStudentEnrollment)
}

export async function resolveSwitchableStudentEnrollment(
  callerStudentDbId: number,
  request: StudentActiveEnrollmentRequest,
): Promise<
  | { ok: true; enrollment: StudentEnrollmentRecord; enrollments: StudentEnrollmentRecord[] }
  | { ok: false; status: 403 | 404; error: string }
> {
  const enrollments = await findEnrollmentsForStudentDbId(callerStudentDbId)
  if (enrollments.length === 0) {
    return { ok: false, status: 404, error: "No active enrollments found." }
  }
  const enrollment = matchStudentEnrollment(enrollments, request)
  if (!enrollment) {
    return { ok: false, status: 403, error: "You are not enrolled in that course." }
  }
  return { ok: true, enrollment, enrollments }
}
