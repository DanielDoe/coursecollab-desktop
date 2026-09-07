import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isPastRegularAssessmentsHardCloseAsync } from "@/lib/regular-assessments-cutoff-server"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/rollover/grant
 * Instructor grants a rollover extension to a student (including non-Trailblazers).
 * Use when a student has a good reason for missing the deadline (e.g., forgot to submit).
 *
 * Body: { studentId: number, quizId: number, hours?: number }
 * - studentId: student's database ID
 * - quizId: assessment ID (quiz/homework/final)
 * - hours: extension duration (default: 24, max: 72)
 */
export async function POST(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id") || request.headers.get("authorization")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const studentId = Number(body.studentId)
    const quizId = Number(body.quizId)
    const hours = Math.min(72, Math.max(1, Number(body.hours) || 72))

    if (!studentId || !quizId || Number.isNaN(studentId) || Number.isNaN(quizId)) {
      return NextResponse.json(
        { error: "studentId and quizId are required" },
        { status: 400 }
      )
    }

    const assessment = await sql`
      SELECT id, title, assessment_type, available_until, rollover_enabled, rollover_hours
      FROM quizzes
      WHERE id = ${quizId} AND deleted_at IS NULL
      LIMIT 1
    `

    if (assessment.length === 0) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    const student = await sql`
      SELECT id, full_name, email FROM students WHERE id = ${studentId} LIMIT 1
    `
    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const q = assessment[0] as {
      id: number
      title: string
      assessment_type?: string | null
      available_until: Date | string | null
      rollover_enabled: boolean | null
      rollover_hours: number | null
    }
    if (isSingleSittingExamAssessmentDbType(q.assessment_type)) {
      return NextResponse.json(
        { error: "Rollover extensions cannot be granted for mid-semester or final exams." },
        { status: 403 }
      )
    }
    if (
      isRegularAssessmentTypeForSemesterCutoff(q.assessment_type) &&
      (await isPastRegularAssessmentsHardCloseAsync())
    ) {
      return NextResponse.json(
        { error: regularAssessmentsClosedMessage(), semesterAssessmentsClosed: true },
        { status: 403 },
      )
    }
    const effectiveHours = q.rollover_hours ? Math.min(72, Math.max(1, Number(q.rollover_hours))) : hours
    const appliedAt = new Date()
    const expiresAt = new Date(appliedAt.getTime() + effectiveHours * 60 * 60 * 1000)

    const existing = await sql`
      SELECT id, expires_at FROM student_assessment_rollovers
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
      LIMIT 1
    `

    const now = new Date()
    if (existing.length > 0) {
      const exp = new Date(existing[0].expires_at)
      if (exp > now) {
        return NextResponse.json({
          success: true,
          message: "Extension already active for this student.",
          expiresAt: exp.toISOString(),
          alreadyGranted: true,
        })
      }
      // Expired - allow instructor to re-grant (update existing)
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

    // Grant retake access (2 extra attempts) so student can complete
    const existingOverride = await sql`
      SELECT id, additional_attempts FROM attempt_overrides
      WHERE student_id = ${studentId} AND quiz_id = ${quizId} AND is_active = true
      LIMIT 1
    `
    const extraAttempts = 2
    if (existingOverride.length > 0) {
      const current = (existingOverride[0] as { additional_attempts: number }).additional_attempts
      await sql`
        UPDATE attempt_overrides
        SET additional_attempts = ${Math.max(current, extraAttempts)}, updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${studentId} AND quiz_id = ${quizId}
      `
    } else {
      await sql`
        INSERT INTO attempt_overrides (quiz_id, student_id, additional_attempts, reason, expires_at)
        VALUES (${quizId}, ${studentId}, ${extraAttempts}, 'Instructor-granted rollover', NULL)
      `
    }

    return NextResponse.json({
      success: true,
      message: `Extension granted. ${student[0].full_name} has ${effectiveHours} hour(s) to complete ${q.title}.`,
      expiresAt: expiresAt.toISOString(),
      hours: effectiveHours,
    })
  } catch (error: unknown) {
    console.error("[Instructor Rollover Grant] Error:", error)
    return NextResponse.json(
      { error: "Failed to grant extension" },
      { status: 500 }
    )
  }
}
