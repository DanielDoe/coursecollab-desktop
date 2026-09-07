import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { submitAnswer, finalizeAttempt } from "@/lib/assessment-core/submit"
import { getAssessmentConfig, saveAnswer as saveAnswerToDb, type AssessmentType } from "@/lib/assessment-core/db"
import type { SubmitAnswerPayload } from "@/lib/assessment-core/submit"
import { resolveAwardedPointsForAiSubmission } from "@/lib/ai-points-consistency"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import { requireAttemptOwnership } from "@/lib/student-api-auth"
import { SERVER_GRADED_QUESTION_TYPES } from "@/lib/server-graded-question-types"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST /api/[assessmentType]/submit
 * 
 * Dynamic submission endpoint for all assessment types
 * Reuses shared submission logic from assessment-core
 */
const LOG = "[Submit]"

/**
 * Question types the server can grade deterministically. For these we ignore
 * any client-supplied `isCorrect` / `pointsEarned` entirely and re-evaluate,
 * because "save-only mode" previously persisted whatever the body claimed:
 * POST {answer:"", isCorrect:true, pointsEarned:100} awarded full marks with
 * no evaluation. Free-form and AI-graded types still use save-only (their
 * evaluation genuinely happens outside this handler) but are clamped to the
 * question's real max_points from the database.
 */
const SERVER_GRADED_TYPES = SERVER_GRADED_QUESTION_TYPES

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentType: string }> }
) {
  const { assessmentType: assessmentTypeParam } = await params
  const assessmentType = assessmentTypeParam as AssessmentType
  try {
    console.log(`${LOG} ${assessmentType} POST received`)
    
    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const dbTypeForCutoff =
      assessmentType === "midsem" ? "mid_semester" : assessmentType

    const body = await request.json()
    console.log(`${LOG} ${assessmentType} Body keys:`, Object.keys(body || {}))
    let {
      attemptId,
      questionId,
      answer,
      questionType,
      plotImage,
      typingReplay,
      timeSpentSeconds,
      isCorrect,
      pointsEarned,
      aiFeedback,
      requiresManualReview,
      feedback,
      finalize = false,
      maxPoints: bodyMaxPoints,
      score: bodyScore,
    } = body

    if (!attemptId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: attemptId, questionId, answer" },
        { status: 400 }
      )
    }

    // SECURITY: identity was previously a claimed parameter — any caller could
    // enumerate attemptIds and write to another student's attempt.
    const ownership = await requireAttemptOwnership(request, Number(attemptId))
    if (!ownership.ok) return ownership.response

    // SECURITY: no attempt-state guard existed, so a finished attempt could be
    // re-submitted question by question and then re-finalized to overwrite the
    // stored score.
    const attemptState = (await sql`
      SELECT completed_at FROM quiz_attempts
      WHERE id = ${attemptId} AND deleted_at IS NULL
      LIMIT 1
    `) as { completed_at: string | null }[]
    if (attemptState[0]?.completed_at) {
      return NextResponse.json(
        { error: "This attempt has already been submitted." },
        { status: 409 },
      )
    }

    if (isRegularAssessmentTypeForSemesterCutoff(dbTypeForCutoff)) {
      const attemptOwner = await sql`
        SELECT student_id FROM quiz_attempts WHERE id = ${attemptId} AND deleted_at IS NULL LIMIT 1
      `
      const ownerId = Number(attemptOwner[0]?.student_id) || 0
      if (
        ownerId > 0 &&
        (await isRegularAssessmentSemesterHardCloseBlockingStudent(ownerId))
      ) {
        return NextResponse.json({ error: regularAssessmentsClosedMessage() }, { status: 403 })
      }
    }

    // For code_write_plot: extract plotImage from answer JSON if not provided in body
    const qt = (questionType || 'mcq').toLowerCase()
    if (qt === 'code_write_plot' && !plotImage && typeof answer === 'string') {
      try {
        const parsed = JSON.parse(answer)
        if (parsed?.plotImage) plotImage = parsed.plotImage
      } catch {
        // Keep answer as-is if not valid JSON
      }
    }

    // SAVE-ONLY MODE: Quiz-taker sends pre-evaluated data (Processing... or eval result)
    // Persist answer + keystrokes immediately so nothing is lost if evaluation fails
    if (SERVER_GRADED_TYPES.has(qt)) {
      // Discard anything the client asserted about correctness or score, then
      // fall through to EVALUATE mode below so the server does the grading.
      isCorrect = undefined
      pointsEarned = undefined
      bodyScore = undefined
      bodyMaxPoints = undefined
    }

    const hasPreEvaluatedData =
      !SERVER_GRADED_TYPES.has(qt) &&
      (isCorrect !== undefined || pointsEarned !== undefined || aiFeedback != null)
    if (hasPreEvaluatedData) {
      const selectedAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer)
      const answerData: Record<string, unknown> = { questionType: questionType || 'mcq' }
      if (typingReplay?.events?.length) {
        answerData.typing_replay = typingReplay
      }
      if (qt === 'code_write_plot' && plotImage) {
        answerData.plotImage = plotImage
        answerData.code = typeof answer === 'string' ? (() => { try { const p = JSON.parse(answer); return p?.code ?? answer } catch { return answer } })() : answer
      } else if (['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_write_plot', 'code_debug'].includes(qt)) {
        answerData.code = typeof answer === 'string' ? answer : JSON.stringify(answer)
      } else if (
        (qt === 'multi_part' || qt === 'circuit_submission') &&
        typeof answer === 'string' &&
        answer.trim().startsWith('{')
      ) {
        try {
          const parsed = JSON.parse(answer) as Record<string, unknown>
          if (parsed && typeof parsed === 'object') {
            Object.assign(answerData, parsed)
          }
        } catch {
          /* keep selected_answer only */
        }
      }
      // SECURITY: max points previously came from `bodyMaxPoints`, so a client
      // could inflate a 1-point question to 100. Source of truth is the row.
      const questionConfig = getAssessmentConfig(assessmentType)
      const maxPointRows = (await sql`
        SELECT COALESCE(NULLIF(max_points, 0), NULLIF(points, 0), 1) AS mp
        FROM ${sql.unsafe(questionConfig.questionsTable)}
        WHERE id = ${questionId}
        LIMIT 1
      `) as { mp: number | string }[]
      const maxPts = Math.max(1, Number(maxPointRows[0]?.mp ?? 1) || 1)
      const tentativePts =
        typeof pointsEarned === "number" && Number.isFinite(pointsEarned)
          ? pointsEarned
          : aiFeedback?.pointsEarned != null && Number.isFinite(Number(aiFeedback.pointsEarned))
            ? Number(aiFeedback.pointsEarned)
            : 0
      const codeTypesSave = [
        "code_write",
        "code_problem",
        "debug_code",
        "code_explain",
        "code_write_plot",
        "code_debug",
      ]
      let saveOnlyAiMode: string | null = null
      if (codeTypesSave.includes(qt)) {
        const config = getAssessmentConfig(assessmentType)
        const modeRows = (await sql`
          SELECT COALESCE(NULLIF(TRIM(quiz.ai_evaluation_mode), ''),
            CASE
              WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
              WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
              WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
              ELSE 'standard'
            END
          ) as ai_evaluation_mode
          FROM ${sql.unsafe(config.questionsTable)} q
          JOIN quizzes quiz ON quiz.id = q.quiz_id
          WHERE q.id = ${questionId}
          LIMIT 1
        `) as { ai_evaluation_mode?: string }[]
        saveOnlyAiMode = modeRows[0]?.ai_evaluation_mode ?? null
      }
      const pts = resolveAwardedPointsForAiSubmission({
        questionType: questionType || "mcq",
        questionMaxPoints: maxPts,
        tentativePoints: tentativePts,
        bodyScore,
        aiFeedback: aiFeedback ?? null,
        aiEvaluationMode: saveOnlyAiMode,
        rawAnswer: answer,
      })
      const clampedPts = Math.min(Math.max(0, Number(pts) || 0), maxPts)
      const isProcessing =
        feedback === "Processing..." ||
        (typeof aiFeedback?.status === "string" && aiFeedback.status === "Processing...")
      const reqReview = isProcessing
        ? false
        : Boolean(requiresManualReview ?? aiFeedback?.requiresManualReview)
      await saveAnswerToDb(assessmentType, {
        attemptId,
        questionId,
        selectedAnswer,
        isCorrect: Boolean(isCorrect ?? (clampedPts > 0)),
        pointsEarned: clampedPts,
        answerData: Object.keys(answerData).length > 1 || answerData.typing_replay ? answerData : undefined,
        feedback: feedback ?? aiFeedback?.feedback ?? null,
        requiresReview: reqReview,
        aiFeedback: aiFeedback ?? null,
        timeSpentSeconds: timeSpentSeconds != null && timeSpentSeconds >= 0 ? timeSpentSeconds : null,
      })
      return NextResponse.json({
        success: true,
        isCorrect: isCorrect ?? (clampedPts > 0),
        pointsEarned: clampedPts,
        maxPoints: maxPts,
        feedback: feedback ?? aiFeedback?.feedback,
        requiresReview: reqReview,
      })
    }

    // EVALUATE MODE: Raw answer - evaluate and save
    console.log(`${LOG} ${assessmentType} EVALUATE mode questionType=${qt}`)
    const payload: SubmitAnswerPayload = {
      assessmentType,
      attemptId,
      questionId,
      answer,
      questionType: questionType || 'mcq',
      plotImage,
      typingReplay: typingReplay ?? undefined,
      timeSpentSeconds: timeSpentSeconds != null && timeSpentSeconds >= 0 ? timeSpentSeconds : undefined,
    }

    const result = await submitAnswer(payload)
    console.log(`${LOG} ${assessmentType} submitAnswer success:`, result.success)

    // Finalize attempt if requested
    if (finalize) {
      await finalizeAttempt(assessmentType, attemptId)
    }

    return NextResponse.json({ ...result, serverGraded: true })
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error(`${LOG} ${assessmentType} CAUGHT:`, err.message)
    console.error(`${LOG} ${assessmentType} Stack:`, err.stack)
    return NextResponse.json(
      { 
        success: false,
        error: err.message || "Failed to submit answer",
        detail: err.message,
        requiresReview: false
      },
      { status: 500 }
    )
  }
}

