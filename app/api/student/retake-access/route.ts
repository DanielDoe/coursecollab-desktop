import { type NextRequest, NextResponse } from "next/server"
import { hasRetakeAccess } from "@/lib/retake-access"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const quizId = searchParams.get("quizId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Parse studentId (could be database ID or student_id string)
    let studentDatabaseId: number
    try {
      studentDatabaseId = parseInt(studentId)
      // Verify it exists
      const { sql } = await import("@/lib/db")
      const check = await sql`SELECT id FROM students WHERE id = ${studentDatabaseId} LIMIT 1`
      if (check.length === 0) {
        // Try as student_id string
        const checkByCode = await sql`SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1`
        if (checkByCode.length === 0) {
          return NextResponse.json({ error: "Student not found" }, { status: 404 })
        }
        studentDatabaseId = checkByCode[0].id
      }
    } catch (error) {
      // Try as student_id string
      const { sql } = await import("@/lib/db")
      const checkByCode = await sql`SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1`
      if (checkByCode.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      studentDatabaseId = checkByCode[0].id
    }

    // Whether the student's plan allows retakes at all (Explorer/Trailblazer/donation)
    const hasRetakeAccessByPlan = await hasRetakeAccess(studentDatabaseId)

    // If quizId is provided, check per-quiz retake access
    if (quizId) {
      const { sql } = await import("@/lib/db")
      const { canRetakeAssessment } = await import("@/lib/retake-utils")
      const { hasActiveDonationTrial } = await import("@/lib/membership")
      const quizIdNum = parseInt(quizId)
      
      const hasDonationAccess = await hasActiveDonationTrial(studentDatabaseId)
      
      const quizResult = await sql`
        SELECT retake_enabled, retake_limit, COALESCE(forfeit_retake_on_report_view, true) as forfeit_retake_on_report_view, available_until
        FROM quizzes
        WHERE id = ${quizIdNum}
        LIMIT 1
      `
      
      if (quizResult.length === 0) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
      }
      
      const { retake_enabled, retake_limit, forfeit_retake_on_report_view } = quizResult[0]
      const forfeitOnReportView = Boolean(forfeit_retake_on_report_view ?? true)

      const { getCompletedAttemptCount } = await import("@/lib/retake-utils")
      const completedAttempts = await getCompletedAttemptCount(studentDatabaseId, quizIdNum)

      const { hasDeadlineExtensionForStudentQuiz } = await import("@/lib/deadline-extension")
      const { isBetaUser } = await import("@/lib/membership")
      const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(studentDatabaseId, quizIdNum)
      const retakeCheck = await canRetakeAssessment(
        studentDatabaseId,
        quizIdNum,
        retake_limit,
        retake_enabled,
        completedAttempts,
        undefined,
        {
          availableUntil: quizResult[0].available_until,
          hasDeadlineExtension: hasDeadlineExt,
          bypassCalendarRetakeExpiry: await isBetaUser(studentDatabaseId),
        },
      )

      const overrideRow = await sql`
        SELECT additional_attempts FROM attempt_overrides
        WHERE student_id = ${studentDatabaseId} AND quiz_id = ${quizIdNum}
          AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `
      const hasAttemptOverride = (Number(overrideRow[0]?.additional_attempts) || 0) > 0

      // Check if report viewing forfeits retake (when forfeit_retake_on_report_view is true)
      const latestAttemptResult = await sql`
        SELECT has_viewed_report, auto_submitted, violation_reason
        FROM quiz_attempts
        WHERE student_id = ${studentDatabaseId}
          AND quiz_id = ${quizIdNum}
          AND deleted_at IS NULL
          AND completed_at IS NOT NULL
        ORDER BY attempt_number DESC
        LIMIT 1
      `
      const latestAttempt = latestAttemptResult[0]
      const hasViewedReport = Boolean(latestAttempt?.has_viewed_report)
      const lastAttemptWasAutoSubmitted = Boolean(latestAttempt?.auto_submitted || latestAttempt?.violation_reason)
      const allowRetakeDespiteViewingReport = lastAttemptWasAutoSubmitted || !forfeitOnReportView
      const reportViewBlocksRetake = forfeitOnReportView && hasViewedReport && !lastAttemptWasAutoSubmitted
      
      // Rollover extends the deadline in the quiz list only; retake eligibility matches start-quiz (membership or override).
      const eligibleByPlanOrOverride =
        hasRetakeAccessByPlan || hasAttemptOverride
      const canRetake =
        retakeCheck.canRetake &&
        eligibleByPlanOrOverride &&
        (!hasViewedReport || allowRetakeDespiteViewingReport)

      let retakeBlockReason: string | null = null
      if (!canRetake && eligibleByPlanOrOverride) {
        if (reportViewBlocksRetake) {
          retakeBlockReason = "retake_forfeited"
        } else if (retakeCheck.calendarRetakePerksExpired) {
          retakeBlockReason = "retake_calendar_expired"
        } else if (!retakeCheck.canRetake) {
          retakeBlockReason = "retake_max_attempts"
        }
      } else if (!canRetake && !eligibleByPlanOrOverride) {
        retakeBlockReason = "retake_no_access"
      }
      
      return NextResponse.json({
        canRetake,
        reason: retakeCheck.reason,
        attemptsRemaining: retakeCheck.attemptsRemaining,
        hasDonationAccess,
        hasRetakeAccess: hasRetakeAccessByPlan,
        retakeBlockReason,
        calendarRetakePerksExpired: retakeCheck.calendarRetakePerksExpired ?? false,
        expiredRetakeSlots: retakeCheck.expiredRetakeSlots ?? null,
      })
    }
    
    return NextResponse.json({
      hasAccess: hasRetakeAccessByPlan,
      canRetake: hasRetakeAccessByPlan,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check retake access", hasAccess: false },
      { status: 500 }
    )
  }
}

