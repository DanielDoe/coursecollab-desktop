import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import { evaluateAssessmentAnswer } from "@/lib/assessment-core/evaluate"
import { getAssessmentConfig, normalizeAssessmentType, type AssessmentType } from "@/lib/assessment-core/db"
import { getDocumentAtTime } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import { getBaseUrl } from "@/lib/get-base-url"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST /api/student/re-evaluate-answer
 *
 * Student-facing re-evaluation for questions that failed or are pending.
 * Verifies student owns the attempt, then re-runs evaluation.
 * Label: "Re-evaluate" (no AI wording - students shouldn't feel AI is grading them).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentDatabaseId = auth.studentDbId

    const { answerId, attemptId: attemptIdParam, questionId: questionIdParam } = body

    let answerIdNum: number
    let attemptIdNum: number
    let questionIdNum: number

    if (answerId) {
      answerIdNum = Number.parseInt(String(answerId), 10)
      if (isNaN(answerIdNum)) {
        return NextResponse.json({ error: "Invalid answerId" }, { status: 400 })
      }
    } else if (attemptIdParam && questionIdParam) {
      attemptIdNum = Number.parseInt(String(attemptIdParam), 10)
      questionIdNum = Number.parseInt(String(questionIdParam), 10)
      if (isNaN(attemptIdNum) || isNaN(questionIdNum)) {
        return NextResponse.json({ error: "Invalid attemptId or questionId" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Provide answerId or (attemptId + questionId)" }, { status: 400 })
    }

    // Fetch answer and verify student owns the attempt
    const answerRows = await sql`
      SELECT 
        qa.id as answer_id,
        qa.attempt_id,
        qa.question_id,
        qa.selected_answer,
        qa.answer_data,
        qa.student_re_evaluate_used_at,
        qa.override_points,
        att.student_id,
        att.quiz_id,
        q.assessment_type as quiz_assessment_type
      FROM quiz_answers qa
      JOIN quiz_attempts att ON att.id = qa.attempt_id
      JOIN quizzes q ON q.id = att.quiz_id
      LEFT JOIN quiz_questions qq ON qq.id = qa.question_id
      WHERE 
        ${answerId ? sql`qa.id = ${answerIdNum}` : sql`qa.attempt_id = ${attemptIdNum} AND qa.question_id = ${questionIdNum}`}
        AND att.student_id = ${studentDatabaseId}
        AND att.deleted_at IS NULL
      LIMIT 1
    `

    if (answerRows.length === 0) {
      return NextResponse.json({ error: "Answer not found or access denied" }, { status: 404 })
    }

    const row = answerRows[0] as any

    // Instructor manual grade on this question — must not be overwritten by student re-eval
    if (row.override_points != null) {
      return NextResponse.json(
        {
          error:
            "Your instructor adjusted the grade for this question. Re-evaluate is not available so that score stays final. Contact your instructor if something looks wrong.",
        },
        { status: 403 }
      )
    }

    // Student gets 1 Re-evaluate per question
    if (row.student_re_evaluate_used_at) {
      return NextResponse.json(
        { error: "You've already used Re-evaluate for this question. It's now waiting for manual review by your instructor." },
        { status: 400 }
      )
    }
    const answerIdRes = row.answer_id
    attemptIdNum = row.attempt_id
    questionIdNum = row.question_id

    // Get full question and quiz for evaluation
    const assessmentType = normalizeAssessmentType(row.quiz_assessment_type) as AssessmentType
    const config = getAssessmentConfig(assessmentType)

    const questions = await sql`
      SELECT 
        q.*,
        COALESCE(q.max_points, q.points, 1) as effective_max_points,
        COALESCE(NULLIF(TRIM(quiz.ai_evaluation_mode), ''),
          CASE
            WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
            WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
            WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
            ELSE 'standard'
          END
        ) as ai_evaluation_mode,
        COALESCE(NULLIF(TRIM(q.ai_code_language), ''), NULLIF(TRIM(quiz.code_language), ''), 'cpp') as code_language,
        quiz.allowed_ai_code_languages
      FROM ${sql.unsafe(config.questionsTable)} q
      JOIN quizzes quiz ON quiz.id = q.quiz_id
      WHERE q.id = ${questionIdNum}
    `
    const question = questions[0]
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // Extract student answer (same logic as instructor re-evaluate)
    const qt = (question.question_type || "").toLowerCase()
    const isCodeQuestion = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(qt)

    let studentAnswer: string | null = null
    let plotImage: string | null = null
    let typingReplay: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | undefined

    if (isCodeQuestion) {
      const candidates: string[] = []
      if (row.selected_answer && String(row.selected_answer).trim()) {
        candidates.push(String(row.selected_answer))
      }
      if (row.answer_data) {
        try {
          const parsed = typeof row.answer_data === "string" ? JSON.parse(row.answer_data) : row.answer_data
          if (parsed?.code && String(parsed.code).trim()) candidates.push(String(parsed.code))
          if (parsed?.answer && String(parsed.answer).trim()) candidates.push(typeof parsed.answer === "string" ? parsed.answer : JSON.stringify(parsed.answer))
          if (parsed?.plotImage && qt === "code_write_plot") plotImage = parsed.plotImage
          if (parsed?.typing_replay?.events?.length) typingReplay = parsed.typing_replay
        } catch {
          if (typeof row.answer_data === "string" && row.answer_data.trim()) candidates.push(row.answer_data)
        }
      }
      // CRITICAL: Always derive from typing_replay when available - add to candidates BEFORE filtering
      if (typingReplay?.events?.length) {
        const lastT = Math.max(...typingReplay.events.map((e: { t: number }) => e.t), 0)
        const derived = getDocumentAtTime(typingReplay, lastT + 1000)
        if (derived?.trim()) candidates.push(derived)
      }
      const validCandidates = candidates.filter((c) => !isCodeAnswerCorrupt(c))
      studentAnswer = validCandidates.length > 0 ? validCandidates.reduce((a, b) => (a.length >= b.length ? a : b)) : null
    } else {
      studentAnswer = row.selected_answer != null && String(row.selected_answer).trim() !== "" ? row.selected_answer : null
      if (studentAnswer == null && row.answer_data) {
        try {
          const ad = typeof row.answer_data === "string" ? JSON.parse(row.answer_data) : row.answer_data
          if (ad && typeof ad === "object" && ad.answer != null) {
            studentAnswer = typeof ad.answer === "string" ? ad.answer : JSON.stringify(ad.answer)
          }
        } catch {
          studentAnswer = typeof row.answer_data === "string" ? row.answer_data : null
        }
      }
    }

    if (!studentAnswer || (typeof studentAnswer === "string" && !studentAnswer.trim())) {
      return NextResponse.json({ error: "No answer found to re-evaluate" }, { status: 400 })
    }

    const baseUrl = getBaseUrl(request.nextUrl?.origin)

    const maxPoints = Number(question.effective_max_points) || 1

    const result = await evaluateAssessmentAnswer({
      assessmentType,
      attemptId: attemptIdNum,
      questionId: questionIdNum,
      question,
      studentAnswer,
      questionType: qt,
      maxPoints,
      plotImage: plotImage ?? undefined,
      aiEvaluationMode: question.ai_evaluation_mode || "standard",
      codeLanguage: (question as { code_language?: string }).code_language || "cpp",
      baseUrl,
      typingReplay: typingReplay ?? undefined,
    })

    // Mark that student used their one Re-evaluate for this question
    try {
      await sql`
        UPDATE quiz_answers
        SET student_re_evaluate_used_at = NOW()
        WHERE id = ${answerIdRes}
      `
    } catch {
      // Column may not exist yet if migration not run
    }

    // Recalculate attempt score and clear PND% (violation_log) when no answers require review
    const attemptScoreResult = await sql`
      SELECT COALESCE(SUM(COALESCE(override_points, points_earned, 0)), 0) as total_score
      FROM quiz_answers
      WHERE attempt_id = ${attemptIdNum}
    `
    const totalScore = Number(attemptScoreResult[0]?.total_score) || 0
    const prevAttemptScore = await sql`
      SELECT score FROM quiz_attempts WHERE id = ${attemptIdNum}
    `
    const previousScore = Number(prevAttemptScore[0]?.score ?? 0)
    await sql`
      UPDATE quiz_attempts
      SET score = ${totalScore}
      WHERE id = ${attemptIdNum}
    `
    await recordAttemptScoreChange({
      attemptId: attemptIdNum,
      previousScore,
      newScore: totalScore,
      source: "student_re_evaluate",
      actorType: "student",
      actorId: studentDatabaseId,
      actorLabel: "Student re-evaluated answer",
      reason: "Quiz Master re-evaluated a question after student request",
      metadata: { questionId: questionIdNum, answerId: answerIdRes },
    })

    const stillRequiresReview = await sql`
      SELECT 1 FROM quiz_answers
      WHERE attempt_id = ${attemptIdNum} AND requires_review = true
      LIMIT 1
    `
    if (stillRequiresReview.length === 0) {
      const logResult = await sql`
        SELECT COALESCE(violation_log, '[]'::jsonb) as violation_log
        FROM quiz_attempts WHERE id = ${attemptIdNum}
      `
      const log = Array.isArray(logResult[0]?.violation_log) ? logResult[0].violation_log : []
      const filtered = log.filter((e: any) => e?.type !== "score_pending" && e?.type !== "evaluation_failed")
      if (filtered.length !== log.length) {
        await sql`
          UPDATE quiz_attempts
          SET violation_log = ${JSON.stringify(filtered)}::jsonb
          WHERE id = ${attemptIdNum}
        `
      }
    }

    const aiFeedback = (result as { aiFeedback?: Record<string, unknown> }).aiFeedback

    return NextResponse.json({
      success: true,
      answerId: answerIdRes,
      isCorrect: result.isCorrect,
      pointsEarned: result.pointsEarned,
      maxPoints,
      feedback: result.feedback,
      requiresManualReview: result.requiresReview,
      aiFeedback,
    })
  } catch (error: any) {
    console.error("[Student Re-evaluate] Error:", error)
    return NextResponse.json(
      { error: "Failed to re-evaluate. Please try again.", details: error?.message },
      { status: 500 }
    )
  }
}
