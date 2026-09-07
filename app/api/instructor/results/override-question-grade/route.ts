import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureQuizAnswerIdForAttemptQuestion } from "@/lib/ensure-quiz-answer-row"
import {
  assessmentUsesSectionWeightedGrade,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  buildPerQuestionEffectivePoints,
  computeSectionWeightedScore,
} from "@/lib/section-weighted-attempt-score"
import { resolveSectionQuestionSelectionsForAttempt } from "@/lib/load-section-question-selections"
import { syncGradebookForAttempt } from "@/lib/grades"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import { tryAutoFinalizePerfectScore } from "@/lib/auto-finalize-perfect-scores"
import { syncAttemptViolationLogFromPndRules } from "@/lib/assessment-pnd-helpers"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"

export const dynamic = "force-dynamic"

/**
 * Manual grade override for a single question.
 * POST /api/instructor/results/override-question-grade
 * Instructor can set custom points when answer keys are wrong or parsing fails.
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")

    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const {
      answerId: answerIdRaw,
      attemptId: attemptIdRaw,
      questionId: questionIdRaw,
      pointsEarned,
      isCorrect,
      solutionUploadScore,
      multiPartGrading,
      circuitSubmissionGrading,
    } = body

    if (pointsEarned === undefined) {
      return NextResponse.json({ error: "pointsEarned is required" }, { status: 400 })
    }

    const gradingAuth = await requireInstructorGradingAccess(request, {
      answerId: answerIdRaw != null ? Number(answerIdRaw) : undefined,
      attemptId: attemptIdRaw != null ? Number(attemptIdRaw) : undefined,
    })
    if (!gradingAuth.ok) return gradingAuth.response

    const instructorId = request.headers.get("x-instructor-id") || request.headers.get("authorization") || (adminId ? `admin:${adminId}` : "instructor")

    let answerIdNum: number
    if (answerIdRaw != null && answerIdRaw !== "") {
      answerIdNum = typeof answerIdRaw === "string" ? parseInt(answerIdRaw, 10) : Number(answerIdRaw)
      if (isNaN(answerIdNum) || answerIdNum <= 0) {
        return NextResponse.json({ error: "Invalid answerId" }, { status: 400 })
      }
    } else if (attemptIdRaw != null && questionIdRaw != null) {
      const aid = typeof attemptIdRaw === "string" ? parseInt(attemptIdRaw, 10) : Number(attemptIdRaw)
      const qid = typeof questionIdRaw === "string" ? parseInt(questionIdRaw, 10) : Number(questionIdRaw)
      if (isNaN(aid) || aid <= 0 || isNaN(qid) || qid <= 0) {
        return NextResponse.json({ error: "Invalid attemptId or questionId" }, { status: 400 })
      }
      try {
        answerIdNum = await ensureQuizAnswerIdForAttemptQuestion(aid, qid)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not create answer row"
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    } else {
      return NextResponse.json(
        { error: "Provide answerId or both attemptId and questionId" },
        { status: 400 },
      )
    }

    const answerData = await sql`
      SELECT qa.id, qa.attempt_id, qa.question_id, qa.points_earned, qa.override_points,
             qa.answer_data, qa.selected_answer,
             COALESCE(qq.max_points, qq.points, 1) as max_points
      FROM quiz_answers qa
      LEFT JOIN quiz_questions qq ON qa.question_id = qq.id
      WHERE qa.id = ${answerIdNum}
    `

    if (answerData.length === 0) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 })
    }

    const answer = answerData[0] as {
      id: number
      attempt_id: number
      question_id: number
      points_earned: number
      override_points: number | null
      max_points: number
      answer_data: unknown
      selected_answer: string | null
    }
    const maxPoints = Number(answer.max_points) || 1
    const finalPoints = Number(pointsEarned)

    if (finalPoints < 0 || finalPoints > maxPoints) {
      return NextResponse.json(
        { error: `Points must be between 0 and ${maxPoints}` },
        { status: 400 }
      )
    }

    const newIsCorrect = isCorrect !== undefined ? Boolean(isCorrect) : finalPoints >= maxPoints * 0.5

    let mergedAnswerData: unknown = answer.answer_data
    let mergedSelectedAnswer: string | null = answer.selected_answer
    if (multiPartGrading && typeof multiPartGrading === "object") {
      let base: Record<string, unknown> = {}
      if (answer.answer_data) {
        try {
          base =
            typeof answer.answer_data === "string"
              ? (JSON.parse(answer.answer_data) as Record<string, unknown>)
              : (answer.answer_data as Record<string, unknown>)
        } catch {
          base = {}
        }
      }
      mergedAnswerData = {
        ...base,
        multi_part_grading: multiPartGrading,
      }
    } else if (circuitSubmissionGrading && typeof circuitSubmissionGrading === "object") {
      mergedAnswerData = circuitSubmissionGrading
      mergedSelectedAnswer = JSON.stringify(circuitSubmissionGrading)
    } else if (solutionUploadScore !== undefined && solutionUploadScore !== null) {
      let base: Record<string, unknown> = {}
      if (answer.answer_data) {
        try {
          base =
            typeof answer.answer_data === "string"
              ? (JSON.parse(answer.answer_data) as Record<string, unknown>)
              : (answer.answer_data as Record<string, unknown>)
        } catch {
          base = {}
        }
      }
      const existing = (base.multi_part_grading as Record<string, unknown>) || {}
      mergedAnswerData = {
        ...base,
        multi_part_grading: {
          ...existing,
          upload_earned: solutionUploadScore,
          upload_pending: false,
          total_earned: finalPoints,
        },
      }
    }

    const attemptData = await sql`
      SELECT quiz_id FROM quiz_attempts WHERE id = ${answer.attempt_id}
    `
    const quizId = (attemptData[0] as { quiz_id?: number })?.quiz_id
    const quizConfig = quizId
      ? await sql`SELECT section_config, assessment_type FROM quizzes WHERE id = ${quizId}`
      : []

    const quizRow = quizId && quizConfig[0] ? (quizConfig[0] as { section_config?: SectionConfig[] | null; assessment_type?: string }) : null
    const sectionConfig = quizRow?.section_config ?? null
    const assessmentType = quizRow?.assessment_type ?? "quiz"
    const useSectionWeighting = assessmentUsesSectionWeightedGrade(assessmentType, sectionConfig)

    async function computeAttemptScore(): Promise<number> {
      if (useSectionWeighting && quizId) {
        const breakdown = await sql`
          SELECT qq.id, qq.question_type,
                 COALESCE(qq.max_points, qq.points, 1) as max_points,
                 qa.override_points, qa.points_earned,
                 (qa.id IS NOT NULL) as has_answer
          FROM quiz_questions qq
          LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${answer.attempt_id}
          WHERE qq.quiz_id = ${quizId}
          ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
        `
        const rows = breakdown as Array<{
          id: number
          question_type: string
          max_points: number
          override_points: number | null
          points_earned: number | null
          has_answer: boolean
        }>
        const answersByQid = new Map(
          rows
            .filter((q) => q.has_answer)
            .map((q) => [q.id, { override_points: q.override_points, points_earned: q.points_earned }]),
        )
        const perQuestion = buildPerQuestionEffectivePoints(
          rows.map((q) => ({ max_points: Number(q.max_points) || 1 })),
          answersByQid,
          rows.map((q) => q.id),
        )
        const sectionQuestionSelections = await resolveSectionQuestionSelectionsForAttempt(
          answer.attempt_id,
          quizId,
          sectionConfig,
        )
        return computeSectionWeightedScore(
          rows.map((q) => ({
            question_type: q.question_type,
            id: q.id,
          })),
          perQuestion,
          sectionConfig,
          {
            sectionQuestionSelections,
            answeredQuestionIds: new Set(answersByQid.keys()),
          },
        )
      }
      const scoreResult = await sql`
        SELECT COALESCE(SUM(COALESCE(override_points, points_earned, 0)), 0) as new_score
        FROM quiz_answers
        WHERE attempt_id = ${answer.attempt_id}
      `
      return parseFloat(scoreResult[0]?.new_score || 0)
    }

    const previousScore = await computeAttemptScore()

    await sql`
      UPDATE quiz_answers
      SET 
        override_points = ${finalPoints},
        is_correct = ${newIsCorrect},
        requires_review = false,
        reviewed_by = ${instructorId},
        reviewed_at = NOW(),
        answer_data = ${mergedAnswerData != null ? JSON.stringify(mergedAnswerData) : null}::jsonb,
        selected_answer = ${mergedSelectedAnswer}
      WHERE id = ${answerIdNum}
    `

    const newScore = await computeAttemptScore()

    if (useSectionWeighting) {
      await sql`
        UPDATE quiz_attempts
        SET score = ${newScore},
            total_score_override = NULL,
            total_questions = 100
        WHERE id = ${answer.attempt_id}
      `
    } else {
      await sql`
        UPDATE quiz_attempts
        SET score = ${newScore},
            total_score_override = NULL
        WHERE id = ${answer.attempt_id}
      `
    }

    await syncGradebookForAttempt(answer.attempt_id)

    const instructorLabel =
      request.headers.get("x-instructor-name")?.trim() ||
      (request.headers.get("x-instructor-id")?.trim() &&
      !/^\d+$/.test(request.headers.get("x-instructor-id")!.trim())
        ? request.headers.get("x-instructor-id")!.trim()
        : "") ||
      "Instructor"
    await recordAttemptScoreChange({
      attemptId: answer.attempt_id,
      previousScore,
      newScore,
      totalPoints: useSectionWeighting ? 100 : undefined,
      source: "instructor_question_override",
      actorType: "instructor",
      actorId: instructorId ?? request.headers.get("x-instructor-id"),
      actorLabel: instructorLabel,
      reason: `Question grade adjusted to ${finalPoints} pts`,
      metadata: { answerId: answerIdNum, questionId: answer.question_id },
    })

    await tryAutoFinalizePerfectScore(answer.attempt_id)
    await syncAttemptViolationLogFromPndRules(answer.attempt_id)

    return NextResponse.json({
      success: true,
      answerId: answerIdNum,
      pointsEarned: finalPoints,
      maxPoints,
      isCorrect: newIsCorrect,
      attemptScore: newScore,
      message: "Grade overridden successfully",
    })
  } catch (error: any) {
    console.error("[Override Question Grade] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to override grade" },
      { status: 500 }
    )
  }
}
