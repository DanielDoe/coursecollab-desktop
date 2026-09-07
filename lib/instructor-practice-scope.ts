import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

/** All instructor-owned courses may use the course-scoped practice question bank. */
export function practiceQuestionBankAllowedForCourseCode(_courseCode: string): boolean {
  return true
}

export async function requireInstructorPracticeBankMutation(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope
  return { ok: true as const, course: scope.course, instructorId: scope.instructorId }
}

export async function studentBelongsToCourse(studentId: number, courseId: number): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM students s
    INNER JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId} AND sess.course_id = ${courseId}
    LIMIT 1
  `
  return Array.isArray(rows) && rows.length > 0
}
