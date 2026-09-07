import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentRolloverConfigForStudent } from "@/lib/membership"
import { buildActiveTermRolloverPolicy, getActiveAcademicTerm, semesterEndDateFromTermEnd } from "@/lib/active-academic-term"
import { getSelfServiceRolloverApplyDeadlineIso } from "@/lib/rollover-policy"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { membershipAssessmentBenefitsAllowedForStudent } from "@/lib/assessment-privilege-governance"
import {
  assessmentPerksExpiredMessage,
  isPastAssessmentPerksExpiry,
} from "@/lib/assessment-perks-expiry"
import { getAssessmentPerksGraceDaysForQuiz } from "@/lib/assessment-perks-grace-resolve"

export const dynamic = "force-dynamic"

/**
 * POST /api/student/rollover/apply
 * Explorer & Trailblazer: self-service past-due extension (membership applies only).
 * Explorer: 1 apply per assessment; window = windowHours (24) to finish.
 * Trailblazer: 3 applies per assessment; each window is windowHours (24).
 * Trade-center / instructor grants do not increment membership_rollover_applies_used.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const studentId = Number(body.studentId)
    const quizId = Number(body.quizId)
    const acknowledgedRules = body.acknowledgedRules === true

    if (!studentId || !quizId || Number.isNaN(studentId) || Number.isNaN(quizId)) {
      return NextResponse.json(
        { error: "studentId and quizId are required" },
        { status: 400 }
      )
    }

    if (!acknowledgedRules) {
      return NextResponse.json(
        {
          error: "Confirm that you understand the extension rules before applying.",
          requiresAcknowledgment: true,
        },
        { status: 400 },
      )
    }

    const activeTerm = await getActiveAcademicTerm()
    const termEnd = semesterEndDateFromTermEnd(activeTerm?.end_date ?? null)
    const rolloverPolicy = await buildActiveTermRolloverPolicy()

    if (!rolloverPolicy.self_service_open) {
      return NextResponse.json(
        {
          error:
            "Self-service Extend is closed for this semester (grade finalization period). Contact your instructor if you need access.",
          rolloverApplyClosed: true,
          applyDeadlineIso: termEnd
            ? getSelfServiceRolloverApplyDeadlineIso(termEnd)
            : rolloverPolicy.apply_deadline_iso,
          semesterEndIso: termEnd?.toISOString() ?? rolloverPolicy.semester_end_iso,
        },
        { status: 403 },
      )
    }

    const membershipPerksAllowed = await membershipAssessmentBenefitsAllowedForStudent(studentId)
    if (!membershipPerksAllowed) {
      return NextResponse.json(
        {
          error:
            "Membership-based assessment extensions are disabled for this course. Contact your instructor about course assessment policies.",
          courseGovernanceBlocked: true,
        },
        { status: 403 },
      )
    }

    const cfg = await getAssessmentRolloverConfigForStudent(studentId)
    if (!cfg.enabled) {
      return NextResponse.json(
        {
          error: "Assessment rollover requires Explorer or Trailblazer. Upgrade to unlock.",
          upgradeRequired: true,
        },
        { status: 403 }
      )
    }

    if (studentId <= 0 || quizId <= 0) {
      return NextResponse.json({ error: "Invalid student or quiz" }, { status: 400 })
    }

    const quiz = await sql`
      SELECT id, available_until, rollover_enabled, rollover_hours, assessment_type
      FROM quizzes
      WHERE id = ${quizId} AND deleted_at IS NULL
      LIMIT 1
    `

    if (quiz.length === 0) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    const q = quiz[0] as {
      id: number
      available_until: Date | string | null
      rollover_enabled: boolean | null
      rollover_hours: number | null
      assessment_type?: string | null
    }
    if (isSingleSittingExamAssessmentDbType(q.assessment_type)) {
      return NextResponse.json(
        { error: "Extensions and rollover are not available for mid-semester or final exams." },
        { status: 403 }
      )
    }
    if (
      isRegularAssessmentTypeForSemesterCutoff(q.assessment_type) &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(studentId))
    ) {
      return NextResponse.json(
        { error: regularAssessmentsClosedMessage(), semesterAssessmentsClosed: true },
        { status: 403 },
      )
    }
    if (!q.rollover_enabled && !membershipPerksAllowed) {
      return NextResponse.json(
        { error: "Rollover is not enabled for this assessment" },
        { status: 403 }
      )
    }

    const availableUntil = q.available_until ? new Date(q.available_until) : null
    const now = new Date()
    if (availableUntil && availableUntil > now) {
      return NextResponse.json(
        { error: "Assessment is not yet past its deadline. No rollover needed." },
        { status: 400 }
      )
    }

    const perksGraceDays = await getAssessmentPerksGraceDaysForQuiz(quizId)
    if (isPastAssessmentPerksExpiry(q.available_until, now, perksGraceDays)) {
      return NextResponse.json(
        {
          error: assessmentPerksExpiredMessage(perksGraceDays),
          perksExpired: true,
        },
        { status: 403 },
      )
    }

    const rolloverHours = Math.max(1, Math.min(72, cfg.windowHours))
    const appliedAt = new Date()
    const expiresAt = new Date(appliedAt.getTime() + rolloverHours * 60 * 60 * 1000)

    const existing = await sql`
      SELECT id, expires_at, COALESCE(membership_rollover_applies_used, 0) AS membership_rollover_applies_used
      FROM student_assessment_rollovers
      WHERE student_id = ${studentId} AND quiz_id = ${quizId}
      LIMIT 1
    `

    let membershipAppliesUsedAfter = 1

    if (existing.length > 0) {
      const row = existing[0] as {
        expires_at: string | Date
        membership_rollover_applies_used: number
      }
      const exp = new Date(row.expires_at)
      if (exp > now) {
        return NextResponse.json({
          success: true,
          message: "Rollover already active",
          expiresAt: exp.toISOString(),
          alreadyApplied: true,
          membershipAppliesUsed: row.membership_rollover_applies_used,
          membershipAppliesMax: cfg.maxAttemptsPerAssessment,
        })
      }

      const used = Number(row.membership_rollover_applies_used) || 0
      if (used >= cfg.maxAttemptsPerAssessment) {
        return NextResponse.json(
          {
            error:
              cfg.maxAttemptsPerAssessment <= 1
                ? "You have already used your rollover for this assessment. The extension window expired before you finished."
                : `You have used all ${cfg.maxAttemptsPerAssessment} membership rollover windows for this assessment.`,
            exhausted: true,
            membershipAppliesUsed: used,
            membershipAppliesMax: cfg.maxAttemptsPerAssessment,
          },
          { status: 403 }
        )
      }

      await sql`
        UPDATE student_assessment_rollovers
        SET
          applied_at = ${appliedAt},
          expires_at = ${expiresAt},
          membership_rollover_applies_used = membership_rollover_applies_used + 1
        WHERE student_id = ${studentId} AND quiz_id = ${quizId}
      `
      membershipAppliesUsedAfter = used + 1
    } else {
      await sql`
        INSERT INTO student_assessment_rollovers (
          student_id,
          quiz_id,
          applied_at,
          expires_at,
          membership_rollover_applies_used
        )
        VALUES (${studentId}, ${quizId}, ${appliedAt}, ${expiresAt}, 1)
      `
    }

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
        VALUES (${quizId}, ${studentId}, ${extraAttempts}, 'Membership rollover - extra attempts', NULL)
      `
    }

    return NextResponse.json({
      success: true,
      message: `Rollover applied. You have ${rolloverHours} hour(s) to complete the assessment.`,
      expiresAt: expiresAt.toISOString(),
      rolloverHours,
      membershipAppliesUsed: membershipAppliesUsedAfter,
      membershipAppliesMax: cfg.maxAttemptsPerAssessment,
    })
  } catch (error: unknown) {
    console.error("[Rollover Apply] Error:", error)
    return NextResponse.json(
      { error: "Failed to apply rollover" },
      { status: 500 }
    )
  }
}
