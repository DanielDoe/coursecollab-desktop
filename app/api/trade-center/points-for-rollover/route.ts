import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  recalculateAndSaveGrade,
  getGradeWeights,
  getGradeRolloverDeductions,
} from "@/lib/grades"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { getSessionCodesWithAll, normalizeSessionForStorage } from "@/lib/session-catalog"
import {
  tradeCenterAssessmentBenefitsAllowedForStudent,
} from "@/lib/assessment-privilege-governance"
import { requireAuthenticatedStudentTradeAccess } from "@/lib/trade-center-student-access"
import {
  assessmentPerksExpiredMessage,
  isPastAssessmentPerksExpiry,
} from "@/lib/assessment-perks-expiry"
import { getAssessmentPerksGraceDaysForCourse, getAssessmentPerksGraceDaysForQuiz } from "@/lib/assessment-perks-grace-resolve"

export const dynamic = "force-dynamic"

const ROLLOVER_COSTS = { 12: 10, 24: 20 } as const
const SOURCE_CATEGORIES = [
  "quiz",
  "homework",
  "midterm",
  "final",
  "attendance",
  "project",
  "classroom",
  "engagement",
] as const
type SourceCategory = (typeof SOURCE_CATEGORIES)[number]

async function normalizeSession(session: string): Promise<string> {
  return normalizeSessionForStorage(session || "ALL")
}

/**
 * GET - Fetch grade breakdown and available assessments for points-for-rollover trade
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
    const session = await normalizeSession(access.normalizedSession)

    // Verify student exists and get section (include session_id for assessment access)
    const studentRows = await sql`
      SELECT s.id, s.section, s.session_id, s.course_id, sess.code as session_code
      FROM students s
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${studentIdNum}
      LIMIT 1
    `
    if (studentRows.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    const studentSection = studentRows[0].session_code || studentRows[0].section || session

    // Recalculate grade to get fresh scores with deductions applied
    const grade = await recalculateAndSaveGrade(studentIdNum, studentSection)
    const weights = await getGradeWeights(studentSection)
    const deductions = await getGradeRolloverDeductions(studentIdNum, studentSection)

    if (!grade || !weights) {
      return NextResponse.json({ error: "Grade data not available" }, { status: 500 })
    }

    // Build category breakdown (raw score on 100% scale, after deductions)
    const categories: Record<
      SourceCategory,
      { score: number; deduction: number; available: number; weight: number }
    > = {
      quiz: {
        score: Number(grade.quiz_score) || 0,
        deduction: deductions.quiz,
        available: Math.max(0, (Number(grade.quiz_score) || 0) - deductions.quiz),
        weight: weights.quiz_weight,
      },
      homework: {
        score: Number(grade.homework_score) || 0,
        deduction: deductions.homework,
        available: Math.max(0, (Number(grade.homework_score) || 0) - deductions.homework),
        weight: weights.homework_weight,
      },
      midterm: {
        score: Number(grade.midterm_score) || 0,
        deduction: deductions.midterm,
        available: Math.max(0, (Number(grade.midterm_score) || 0) - deductions.midterm),
        weight: weights.midterm_weight,
      },
      final: {
        score: Number(grade.final_score) || 0,
        deduction: deductions.final,
        available: Math.max(0, (Number(grade.final_score) || 0) - deductions.final),
        weight: weights.final_weight,
      },
      attendance: {
        score: Number(grade.attendance_score) || 0,
        deduction: deductions.attendance,
        available: Math.max(0, (Number(grade.attendance_score) || 0) - deductions.attendance),
        weight: weights.attendance_weight,
      },
      project: {
        score: Number(grade.project_score) || 0,
        deduction: deductions.project,
        available: Math.max(0, (Number(grade.project_score) || 0) - deductions.project),
        weight: weights.project_weight,
      },
      classroom: {
        score: Number(grade.classroom_score) || 0,
        deduction: deductions.classroom,
        available: Math.max(0, (Number(grade.classroom_score) || 0) - deductions.classroom),
        weight: weights.classroom_weight,
      },
      engagement: {
        score: Number(grade.engagement_credits) || 0,
        deduction: deductions.engagement,
        available: Math.max(0, (Number(grade.engagement_credits) || 0) - deductions.engagement),
        weight: weights.engagement_weight,
      },
    }

    // Available points = current displayed score (already has deductions applied)
    // So "available to trade" = score (which is post-deduction). We need raw - deduction for display.
    // Actually: score in grade is already adjusted. So "available" to trade from a category = current score.
    // When we trade 10 pts, new score = score - 10. So available = score.
    for (const cat of SOURCE_CATEGORIES) {
      categories[cat].available = categories[cat].score
    }

    // Fetch past-due assessments with rollover enabled that student has access to.
    // Use student's session_id first (works for sections like ELEG1304P01); fallback to lookup by code.
    const sessionIdByCode = await sql`
      SELECT id FROM sessions WHERE code = ${studentSection} LIMIT 1
    `
    const sessionId = studentRows[0].session_id ?? sessionIdByCode[0]?.id

    let assessments: { id: number; title: string; assessment_type: string; rollover_hours: number; available_until: Date }[] = []
    if (sessionId) {
      const studentCourseId =
        studentRows[0].course_id != null ? Number(studentRows[0].course_id) : null
      const graceDays = await getAssessmentPerksGraceDaysForCourse(studentCourseId)
      const rows = await sql`
        SELECT q.id, q.title, q.assessment_type, q.rollover_hours, q.available_until
        FROM quizzes q
        JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${sessionId} AND qsa.is_active = true
        LEFT JOIN course_policies cp ON cp.course_id = q.course_id
        WHERE q.deleted_at IS NULL
          AND COALESCE(q.rollover_enabled, false) = true
          AND q.assessment_type IS NOT NULL
          AND LOWER(TRIM(q.assessment_type::text)) NOT IN ('final', 'finals', 'final_exam', 'mid_semester', 'mid-semester', 'midsem')
          AND q.available_until IS NOT NULL
          AND q.available_until < NOW()
          AND NOW() <= q.available_until + (
            COALESCE(
              (cp.grading_policy->>'assessment_perks_grace_days_after_deadline')::int,
              ${graceDays}::int
            ) * INTERVAL '1 day'
          )
        ORDER BY q.assessment_type, q.title
      `
      assessments = rows as typeof assessments
    }

    // Filter to assessments student doesn't already have active rollover for
    const existingRollovers = await sql`
      SELECT quiz_id FROM student_assessment_rollovers
      WHERE student_id = ${studentIdNum} AND (expires_at IS NULL OR expires_at > NOW())
    `
    const activeQuizIds = new Set(existingRollovers.map((r) => r.quiz_id))
    const availableAssessments = assessments.filter((a) => !activeQuizIds.has(a.id))

    return NextResponse.json({
      categories,
      assessments: availableAssessments.map((a) => ({
        id: a.id,
        title: a.title,
        assessment_type: a.assessment_type,
        rollover_hours: a.rollover_hours ?? 24,
        available_until: a.available_until,
      })),
      costs: { "12": 10, "24": 20 },
    })
  } catch (error) {
    console.error("[Points for Rollover] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

/**
 * POST - Apply points-for-rollover trade
 * Body: { studentId, session, quizId, hours, sourceCategory }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session: sessionParam, quizId, hours, sourceCategory } = body

    const access = await requireAuthenticatedStudentTradeAccess(
      request,
      body.studentId,
      String(sessionParam ?? ""),
    )
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    const studentIdNum = access.studentId

    if (!sessionParam || !quizId || !hours || !sourceCategory) {
      return NextResponse.json(
        { error: "studentId, session, quizId, hours, and sourceCategory are required" },
        { status: 400 }
      )
    }

    const quizIdNum = parseInt(quizId, 10)
    const hoursNum = hours === 24 || hours === "24" ? 24 : 12
    const pointsCost = ROLLOVER_COSTS[hoursNum as 12 | 24]

    if (isNaN(studentIdNum) || isNaN(quizIdNum)) {
      return NextResponse.json({ error: "Invalid student or quiz ID" }, { status: 400 })
    }

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

    if (!SOURCE_CATEGORIES.includes(sourceCategory)) {
      return NextResponse.json({ error: "Invalid source category" }, { status: 400 })
    }

    const session = await normalizeSession(access.normalizedSession)

    // Get student's session for grade lookup fallback (grades may be stored under session code or ALL)
    const studentForGrade = await sql`
      SELECT s.id, sess.code as session_code
      FROM students s
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${studentIdNum}
      LIMIT 1
    `
    const studentSessionCode = studentForGrade[0]?.session_code

    // Verify assessment exists and has rollover enabled
    const quizRows = await sql`
      SELECT id, title, rollover_enabled, rollover_hours, assessment_type, available_until
      FROM quizzes
      WHERE id = ${quizIdNum} AND deleted_at IS NULL
      LIMIT 1
    `
    if (quizRows.length === 0) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }
    const quiz = quizRows[0] as {
      id: number
      title: string
      rollover_enabled: boolean | null
      rollover_hours: number | null
      assessment_type?: string | null
      available_until: Date | string | null
    }
    if (isSingleSittingExamAssessmentDbType(quiz.assessment_type)) {
      return NextResponse.json(
        { error: "Mid-semester and final exams cannot use grade-point rollover trades." },
        { status: 403 },
      )
    }
    if (
      isRegularAssessmentTypeForSemesterCutoff(quiz.assessment_type) &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(studentIdNum))
    ) {
      return NextResponse.json(
        { error: regularAssessmentsClosedMessage(), semesterAssessmentsClosed: true },
        { status: 403 },
      )
    }
    if (!quiz.rollover_enabled) {
      return NextResponse.json({ error: "Assessment does not support rollover" }, { status: 400 })
    }

    const perksGraceDays = await getAssessmentPerksGraceDaysForQuiz(quizIdNum)
    if (isPastAssessmentPerksExpiry(quiz.available_until, new Date(), perksGraceDays)) {
      return NextResponse.json(
        { error: assessmentPerksExpiredMessage(perksGraceDays), perksExpired: true },
        { status: 403 },
      )
    }

    // Check if student already has active rollover for this assessment
    const existing = await sql`
      SELECT id, expires_at FROM student_assessment_rollovers
      WHERE student_id = ${studentIdNum} AND quiz_id = ${quizIdNum}
      LIMIT 1
    `
    if (existing.length > 0) {
      const exp = new Date(existing[0].expires_at)
      if (exp > new Date()) {
        return NextResponse.json(
          { error: "You already have an active rollover for this assessment" },
          { status: 400 }
        )
      }
    }

    // Get current grade to verify student has enough points in the category.
    // Try session first, then ALL, then student's session code (for sections like ELEG1304P01).
    const storedStudentSession = studentSessionCode
      ? await normalizeSessionForStorage(String(studentSessionCode))
      : null
    const gradeSessionSet = new Set(await getSessionCodesWithAll())
    const sessionsToTry = [
      session,
      ...(session !== "ALL" ? ["ALL"] : []),
      ...(storedStudentSession &&
      storedStudentSession !== session &&
      gradeSessionSet.has(storedStudentSession)
        ? [storedStudentSession]
        : []),
    ]
    const uniqueSessions = [...new Set(sessionsToTry)]
    let gradeRows: { quiz_score: number; homework_score: number; midterm_score: number; final_score: number; attendance_score: number; project_score: number; classroom_score: number; engagement_credits: number }[] = []
    for (const sess of uniqueSessions) {
      if (!gradeSessionSet.has(sess)) continue
      const rows = await sql`
        SELECT quiz_score, homework_score, midterm_score, final_score,
               attendance_score, project_score, classroom_score, engagement_credits
        FROM student_grades
        WHERE student_id = ${studentIdNum} AND session = ${sess}
        LIMIT 1
      `
      if (rows.length > 0) {
        gradeRows = rows as typeof gradeRows
        break
      }
    }

    if (gradeRows.length === 0) {
      return NextResponse.json({ error: "Grade record not found. Complete some assessments first." }, { status: 400 })
    }

    const grade = gradeRows[0]
    const categoryToColumn: Record<SourceCategory, string> = {
      quiz: "quiz_score",
      homework: "homework_score",
      midterm: "midterm_score",
      final: "final_score",
      attendance: "attendance_score",
      project: "project_score",
      classroom: "classroom_score",
      engagement: "engagement_credits",
    }
    const col = categoryToColumn[sourceCategory]
    const currentScore = Number(grade[col as keyof typeof grade]) || 0

    if (currentScore < pointsCost) {
      return NextResponse.json(
        {
          error: `Insufficient points in ${sourceCategory}. You have ${currentScore.toFixed(0)} pts (need ${pointsCost}).`,
        },
        { status: 400 }
      )
    }

    const effectiveHours = Number(quiz.rollover_hours) || hoursNum
    const appliedAt = new Date()
    const expiresAt = new Date(appliedAt.getTime() + effectiveHours * 60 * 60 * 1000)

    // Insert grade_rollover_trades
    await sql`
      INSERT INTO grade_rollover_trades (
        student_id, session, quiz_id, hours, points_cost, source_category, points_deducted
      )
      VALUES (${studentIdNum}, ${session}, ${quizIdNum}, ${effectiveHours}, ${pointsCost}, ${sourceCategory}, ${pointsCost})
    `

    // Upsert student_assessment_rollovers
    if (existing.length > 0) {
      await sql`
        UPDATE student_assessment_rollovers
        SET applied_at = ${appliedAt}, expires_at = ${expiresAt}
        WHERE student_id = ${studentIdNum} AND quiz_id = ${quizIdNum}
      `
    } else {
      await sql`
        INSERT INTO student_assessment_rollovers (student_id, quiz_id, applied_at, expires_at, membership_rollover_applies_used)
        VALUES (${studentIdNum}, ${quizIdNum}, ${appliedAt}, ${expiresAt}, 0)
      `
    }

    // Grant retake access (2 extra attempts) so student can complete
    const existingOverride = await sql`
      SELECT id, additional_attempts FROM attempt_overrides
      WHERE student_id = ${studentIdNum} AND quiz_id = ${quizIdNum} AND is_active = true
      LIMIT 1
    `
    const extraAttempts = 2
    if (existingOverride.length > 0) {
      const current = (existingOverride[0] as { additional_attempts: number }).additional_attempts
      await sql`
        UPDATE attempt_overrides
        SET additional_attempts = ${Math.max(current, extraAttempts)}, updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${studentIdNum} AND quiz_id = ${quizIdNum}
      `
    } else {
      await sql`
        INSERT INTO attempt_overrides (quiz_id, student_id, additional_attempts, reason, expires_at)
        VALUES (${quizIdNum}, ${studentIdNum}, ${extraAttempts}, 'Points-for-rollover trade', NULL)
      `
    }

    // Recalculate grade to apply deduction
    await recalculateAndSaveGrade(studentIdNum, session)

    return NextResponse.json({
      success: true,
      message: `Rollover granted! ${pointsCost} pts deducted from ${sourceCategory}. You have until ${expiresAt.toISOString()} to complete ${quiz.title}.`,
      expiresAt: expiresAt.toISOString(),
      hours: effectiveHours,
    })
  } catch (error) {
    console.error("[Points for Rollover] POST error:", error)
    return NextResponse.json({ error: "Failed to process trade" }, { status: 500 })
  }
}
