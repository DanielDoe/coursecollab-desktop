import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { recalculateAndSaveGrade } from "@/lib/grades"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { tradeCenterAssessmentBenefitsAllowedForStudent } from "@/lib/assessment-privilege-governance"
import { requireAuthenticatedStudentTradeAccess } from "@/lib/trade-center-student-access"
import {
  EXTRA_ATTEMPT_COSTS,
  buildTradeCenterCategoryBreakdown,
  categoryScoreFromGradeRow,
  ensureGradeExtraAttemptTradesTable,
  getTradeCenterStudentContext,
  grantTradeCenterExtraAttempts,
  isTradeCenterSourceCategory,
  listSessionAccessibleAssessments,
  loadStudentGradeRow,
  normalizeTradeSession,
  validateAssessmentForTrade,
} from "@/lib/trade-center-grade-point-trade"

export const dynamic = "force-dynamic"

/**
 * GET - Grade categories and session assessments for points-for-extra-attempts trade
 * Query: studentId, session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionParam = searchParams.get("session") || "ALL"

    const access = await requireAuthenticatedStudentTradeAccess(
      request,
      searchParams.get("studentId"),
      sessionParam,
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    const studentIdNum = access.studentId
    const session = await normalizeTradeSession(sessionParam)

    await ensureGradeExtraAttemptTradesTable()

    const ctx = await getTradeCenterStudentContext(studentIdNum)
    if (!ctx) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentSection = ctx.sectionCode || session
    const breakdown = await buildTradeCenterCategoryBreakdown(studentIdNum, studentSection)
    if (!breakdown) {
      return NextResponse.json({ error: "Grade data not available" }, { status: 500 })
    }

    const assessments = await listSessionAccessibleAssessments(ctx.sessionId, studentSection, "extra_attempts")

    return NextResponse.json({
      categories: breakdown.categories,
      assessments,
      costs: { "1": EXTRA_ATTEMPT_COSTS[1], "2": EXTRA_ATTEMPT_COSTS[2] },
    })
  } catch (error) {
    console.error("[Points for Extra Attempts] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

/**
 * POST - Trade grade points for extra attempts on an assessment
 * Body: { studentId, session, quizId, additionalAttempts, sourceCategory }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session: sessionParam, quizId, additionalAttempts, sourceCategory } = body

    const access = await requireAuthenticatedStudentTradeAccess(
      request,
      body.studentId,
      String(sessionParam ?? ""),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    const studentIdNum = access.studentId

    if (!sessionParam || !quizId || !additionalAttempts || !sourceCategory) {
      return NextResponse.json(
        { error: "studentId, session, quizId, additionalAttempts, and sourceCategory are required" },
        { status: 400 },
      )
    }

    const quizIdNum = parseInt(quizId, 10)
    const attemptsNum = additionalAttempts === 2 || additionalAttempts === "2" ? 2 : 1
    const pointsCost = EXTRA_ATTEMPT_COSTS[attemptsNum as 1 | 2]

    if (isNaN(studentIdNum) || isNaN(quizIdNum)) {
      return NextResponse.json({ error: "Invalid student or quiz ID" }, { status: 400 })
    }

    await ensureGradeExtraAttemptTradesTable()

    const tradeCenterAllowed = await tradeCenterAssessmentBenefitsAllowedForStudent(studentIdNum)
    if (!tradeCenterAllowed) {
      return NextResponse.json(
        {
          error:
            "Trade Center assessment redemptions are not enabled for this course. Your instructor controls assessment policies.",
          courseGovernanceBlocked: true,
        },
        { status: 403 },
      )
    }

    if (!isTradeCenterSourceCategory(sourceCategory)) {
      return NextResponse.json({ error: "Invalid source category" }, { status: 400 })
    }

    const session = await normalizeTradeSession(sessionParam || "ALL")

    const ctx = await getTradeCenterStudentContext(studentIdNum)
    if (!ctx) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const assessmentCheck = await validateAssessmentForTrade({ quizId: quizIdNum, blockFinals: true })
    if (!assessmentCheck.ok) {
      return NextResponse.json(
        { error: assessmentCheck.error, semesterAssessmentsClosed: assessmentCheck.semesterAssessmentsClosed },
        { status: assessmentCheck.status },
      )
    }
    const quiz = assessmentCheck.quiz

    if (
      isRegularAssessmentTypeForSemesterCutoff(quiz.assessment_type) &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(studentIdNum))
    ) {
      return NextResponse.json(
        { error: regularAssessmentsClosedMessage(), semesterAssessmentsClosed: true },
        { status: 403 },
      )
    }

    const accessible = await listSessionAccessibleAssessments(ctx.sessionId, ctx.sectionCode, "extra_attempts")
    if (!accessible.some((a) => a.id === quizIdNum)) {
      return NextResponse.json({ error: "You do not have access to this assessment." }, { status: 403 })
    }

    const grade = await loadStudentGradeRow(studentIdNum, session, ctx.sectionCode)
    if (!grade) {
      return NextResponse.json({ error: "Grade record not found. Complete some assessments first." }, { status: 400 })
    }

    const currentScore = categoryScoreFromGradeRow(grade, sourceCategory)
    if (currentScore < pointsCost) {
      return NextResponse.json(
        {
          error: `Insufficient points in ${sourceCategory}. You have ${currentScore.toFixed(0)} pts (need ${pointsCost}).`,
        },
        { status: 400 },
      )
    }

    await sql`
      INSERT INTO grade_extra_attempt_trades (
        student_id, session, quiz_id, additional_attempts, points_cost, source_category, points_deducted
      )
      VALUES (
        ${studentIdNum}, ${session}, ${quizIdNum}, ${attemptsNum}, ${pointsCost}, ${sourceCategory}, ${pointsCost}
      )
    `

    await grantTradeCenterExtraAttempts({
      studentId: studentIdNum,
      quizId: quizIdNum,
      additionalAttempts: attemptsNum,
      reason: "Points-for-extra-attempts trade",
    })

    await recalculateAndSaveGrade(studentIdNum, ctx.sectionCode)

    return NextResponse.json({
      success: true,
      message: `Extra attempts granted! ${pointsCost} pts deducted from ${sourceCategory}. You received +${attemptsNum} attempt(s) on ${quiz.title}.`,
      additionalAttempts: attemptsNum,
      quizTitle: quiz.title,
    })
  } catch (error) {
    console.error("[Points for Extra Attempts] POST error:", error)
    return NextResponse.json({ error: "Failed to process trade" }, { status: 500 })
  }
}
