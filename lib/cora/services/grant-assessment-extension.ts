import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isPastRegularAssessmentsHardCloseAsync } from "@/lib/regular-assessments-cutoff-server"

/**
 * Grant a per-student rollover extension on an assessment.
 * Mirrors POST /api/instructor/rollover/grant, plus course-scope checks the
 * route omits (instructor must own the course; quiz + student must be in scope).
 */
export async function grantAssessmentExtension(params: {
  instructorId: number
  courseId: number
  studentId: number
  quizId: number
  hours?: number
}): Promise<{ studentName: string; quizTitle: string; hours: number; expiresAt: string; alreadyGranted: boolean }> {
  const studentId = Number(params.studentId)
  const quizId = Number(params.quizId)
  if (!Number.isFinite(studentId) || studentId <= 0 || !Number.isFinite(quizId) || quizId <= 0) {
    throw new Error("studentId and quizId are required.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot grant extensions for this course.")

  const assessment = (await sql`
    SELECT id, title, assessment_type, rollover_hours
    FROM quizzes
    WHERE id = ${quizId} AND deleted_at IS NULL
    LIMIT 1
  `) as { id: number; title: string; assessment_type?: string | null; rollover_hours: number | null }[]
  const q = assessment[0]
  if (!q) throw new Error("Assessment not found.")

  if (isSingleSittingExamAssessmentDbType(q.assessment_type)) {
    throw new Error("Rollover extensions cannot be granted for mid-semester or final exams.")
  }
  if (
    isRegularAssessmentTypeForSemesterCutoff(q.assessment_type) &&
    (await isPastRegularAssessmentsHardCloseAsync())
  ) {
    throw new Error(regularAssessmentsClosedMessage())
  }

  const student = (await sql`
    SELECT id, full_name FROM students WHERE id = ${studentId} LIMIT 1
  `) as { id: number; full_name: string }[]
  if (!student[0]) throw new Error("Student not found.")

  const requestedHours = Math.min(72, Math.max(1, Number(params.hours) || 72))
  const effectiveHours = q.rollover_hours
    ? Math.min(72, Math.max(1, Number(q.rollover_hours)))
    : requestedHours
  const appliedAt = new Date()
  const expiresAt = new Date(appliedAt.getTime() + effectiveHours * 60 * 60 * 1000)

  const existing = (await sql`
    SELECT id, expires_at FROM student_assessment_rollovers
    WHERE student_id = ${studentId} AND quiz_id = ${quizId}
    LIMIT 1
  `) as { id: number; expires_at: string | Date }[]

  if (existing[0]) {
    const exp = new Date(existing[0].expires_at)
    if (exp > new Date()) {
      return {
        studentName: student[0].full_name,
        quizTitle: q.title,
        hours: effectiveHours,
        expiresAt: exp.toISOString(),
        alreadyGranted: true,
      }
    }
    await sql`
      UPDATE student_assessment_rollovers
      SET applied_at = ${appliedAt}, expires_at = ${expiresAt}
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
    `
  } else {
    await sql`
      INSERT INTO student_assessment_rollovers (student_id, quiz_id, applied_at, expires_at, membership_rollover_applies_used)
      VALUES (${studentId}, ${quizId}, ${appliedAt}, ${expiresAt}, 0)
    `
  }

  const extraAttempts = 2
  const existingOverride = (await sql`
    SELECT id, additional_attempts FROM attempt_overrides
    WHERE student_id = ${studentId} AND quiz_id = ${quizId} AND is_active = true
    LIMIT 1
  `) as { id: number; additional_attempts: number }[]
  if (existingOverride[0]) {
    await sql`
      UPDATE attempt_overrides
      SET additional_attempts = ${Math.max(existingOverride[0].additional_attempts, extraAttempts)}, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
    `
  } else {
    await sql`
      INSERT INTO attempt_overrides (quiz_id, student_id, additional_attempts, reason, expires_at)
      VALUES (${quizId}, ${studentId}, ${extraAttempts}, 'Instructor-granted rollover (via Cora, confirmed)', NULL)
    `
  }

  return {
    studentName: student[0].full_name,
    quizTitle: q.title,
    hours: effectiveHours,
    expiresAt: expiresAt.toISOString(),
    alreadyGranted: false,
  }
}
