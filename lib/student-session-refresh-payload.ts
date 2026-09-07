import { getSQL } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { getUniversityById, type UniversityRecord } from "@/lib/universities"
import { findEnrollmentsForStudentDbId, publicStudentEnrollments } from "@/lib/student-active-enrollment"
import { serializeStudentEnrollment } from "@/lib/student-active-enrollment-logic"

export type StudentSessionRefreshPayload = {
  rememberMe: boolean
  effectiveMembershipTier: string
  university: UniversityRecord
  student: Record<string, unknown>
  enrollment: ReturnType<typeof serializeStudentEnrollment>
  enrollments: Array<ReturnType<typeof serializeStudentEnrollment>>
}

/** Build client session payload after a valid refresh cookie is verified. */
export async function buildStudentSessionRefreshPayload(params: {
  studentDbId: number
  universityId: number | null
  rememberMe: boolean
}): Promise<StudentSessionRefreshPayload | null> {
  const sql = getSQL()
  const rows = (await sql`
    SELECT * FROM students
    WHERE id = ${params.studentDbId} AND deleted_at IS NULL
    LIMIT 1
  `) as Record<string, unknown>[]
  if (rows.length === 0) return null

  const student = rows[0]
  const universityId =
    params.universityId ??
    (student.university_id != null ? Number(student.university_id) : null)
  if (universityId == null || !Number.isFinite(universityId)) return null

  const university = await getUniversityById(universityId)
  if (!university) return null

  const enrollments = await findEnrollmentsForStudentDbId(params.studentDbId)
  if (enrollments.length === 0) return null

  const selected =
    enrollments.find((row) => row.studentRowId === params.studentDbId) ??
    enrollments.find((row) => {
      const courseId = student.course_id != null ? Number(student.course_id) : null
      return courseId != null && row.courseId === courseId
    }) ??
    enrollments[0]
  if (!selected) return null

  const effectiveMembershipTier = await getEffectiveMembershipTier(params.studentDbId)
  const section = String(student.section ?? selected.section ?? "").trim() || selected.section

  return {
    rememberMe: params.rememberMe,
    effectiveMembershipTier,
    university,
    student,
    enrollment: serializeStudentEnrollment({ ...selected, section }),
    enrollments: publicStudentEnrollments(enrollments),
  }
}
