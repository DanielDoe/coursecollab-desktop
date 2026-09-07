import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get("attemptId")

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 })
    }

    // Use unified quiz_attempts and quizzes tables (mid-semesters are stored as quizzes with assessment_type='mid_semester')
    const [attempt] = await sql`
      SELECT 
        qa.id,
        qa.quiz_id,
        qa.student_id,
        qa.attempt_number,
        qa.has_viewed_report,
        qa.is_final_grade,
        q.retake_enabled,
        q.retake_limit,
        q.available_until
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${parseInt(attemptId)}
        AND qa.deleted_at IS NULL
        AND q.assessment_type = 'mid_semester'
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempts = await sql`
      SELECT id, attempt_number, completed_at, has_viewed_report, is_final_grade
      FROM quiz_attempts
      WHERE student_id = ${attempt.student_id}
        AND quiz_id = ${attempt.quiz_id}
        AND deleted_at IS NULL
        AND completed_at IS NOT NULL
      ORDER BY attempt_number DESC, id DESC
    `

    const hasViewedReport = attempt.has_viewed_report || false
    const hasFinalGrade = attempt.is_final_grade || false

    // Use proper retake logic that respects student donation/membership benefits
    const { canRetakeAssessment } = await import("@/lib/retake-utils")
    const { hasDeadlineExtensionForStudentQuiz } = await import("@/lib/deadline-extension")
    const { isBetaUser } = await import("@/lib/membership")
    const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(
      attempt.student_id,
      attempt.quiz_id,
    )
    const retakeCheck = await canRetakeAssessment(
      attempt.student_id,
      attempt.quiz_id,
      attempt.retake_limit,
      attempt.retake_enabled,
      attempts.length,
      undefined,
      {
        availableUntil: (attempt as { available_until?: string | null }).available_until,
        hasDeadlineExtension: hasDeadlineExt,
        bypassCalendarRetakeExpiry: await isBetaUser(attempt.student_id),
      },
    )

    // Additional checks: report viewing and final grade status
    const canRetake = retakeCheck.canRetake && !hasViewedReport && !hasFinalGrade

    console.log("[v0] DEBUG Mid-semester retake status result:", {
      canRetake,
      attemptsRemaining: retakeCheck.attemptsRemaining,
      totalAttempts: attempts.length,
      hasViewedReport,
      hasFinalGrade,
      effectiveLimit: retakeCheck.attemptsRemaining !== null ? (retakeCheck.attemptsRemaining + attempts.length) : null,
    })

    return NextResponse.json({
      canRetake,
      attemptsRemaining: retakeCheck.attemptsRemaining,
      calendarRetakePerksExpired: retakeCheck.calendarRetakePerksExpired ?? false,
      expiredRetakeSlots: retakeCheck.expiredRetakeSlots ?? null,
      totalAttempts: attempts.length,
      hasViewedReport,
      hasFinalGrade,
    })
  } catch (error) {
    console.error("[v0] Failed to check mid-semester retake status:", error)
    return NextResponse.json({ error: "Failed to check retake status" }, { status: 500 })
  }
}
