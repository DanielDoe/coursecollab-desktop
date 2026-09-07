import { sql } from "@/lib/db"
import { parseAttendancePolicy, type AttendancePolicy } from "@/lib/course-policy-settings"

export async function getAttendancePolicyForCourse(
  courseId: number | null | undefined,
): Promise<AttendancePolicy> {
  if (courseId == null || !Number.isFinite(courseId)) {
    return parseAttendancePolicy(null)
  }

  const rows = await sql`
    SELECT attendance_policy
    FROM course_policies
    WHERE course_id = ${courseId}
    LIMIT 1
  `

  return parseAttendancePolicy(rows[0]?.attendance_policy)
}

export async function getAttendancePolicyForStudent(studentDbId: number): Promise<AttendancePolicy> {
  const rows = await sql`
    SELECT course_id FROM students WHERE id = ${studentDbId} LIMIT 1
  `
  const courseId = rows[0]?.course_id != null ? Number(rows[0].course_id) : null
  return getAttendancePolicyForCourse(courseId)
}
