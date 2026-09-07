import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { groupQuestionsBySections, calculateWeightedScore } from "@/lib/assessment-sections"
import type { SectionConfig } from "@/lib/assessment-sections"
import { syncGradebookForAttempt } from "@/lib/grades"

export const dynamic = "force-dynamic"

/**
 * Manual grade override for a single question.
 * Instructor can set custom points when answer keys are wrong or parsing fails.
 * Updates override_points, is_correct, and recalculates attempt score.
 * For quizzes with section_config (e.g. mid-semester 20%+20%+60%), uses weighted formula.
 * NEVER touches selected_answer, answer_data, or question_id.
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")

    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const { answerId, pointsEarned, isCorrect } = await request.json()

    if (!answerId || pointsEarned === undefined) {
      return NextResponse.json({ error: "answerId and pointsEarned are required" }, { status: 400 })
    }

    const instructorId = request.headers.get("x-instructor-id") || request.headers.get("authorization") || (adminId ? `admin:${adminId}` : "instructor")

    const answerData = await sql`
      SELECT qa.id, qa.attempt_id, qa.question_id, qa.points_earned, qa.override_points,
             COALESCE(qq.max_points, qq.points, 1) as max_points
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      WHERE qa.id = ${answerId}
    `

    if (answerData.length === 0) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 })
    }

    const answer = answerData[0] as { id: number; attempt_id: number; question_id: number; points_earned: number; override_points: number | null; max_points: number }
    const maxPoints = Number(answer.max_points) || 1

    if (pointsEarned < 0 || pointsEarned > maxPoints) {
      return NextResponse.json(
        { error: `Points must be between 0 and ${maxPoints}` },
        { status: 400 }
      )
    }

    const newIsCorrect = isCorrect !== undefined ? Boolean(isCorrect) : pointsEarned >= maxPoints * 0.5

    await sql`
      UPDATE quiz_answers
      SET 
        override_points = ${pointsEarned},
        is_correct = ${newIsCorrect},
        requires_review = false,
        reviewed_by = ${instructorId},
        reviewed_at = NOW()
      WHERE id = ${answerId}
    `

    // Fetch quiz section_config and assessment_type. Section weighting only for mid-semester/finals.
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
    const isSectionizedAssessment =
      assessmentType === "mid_semester" || assessmentType === "midsem" || assessmentType === "final"
    const useWeightedSections =
      quizId &&
      isSectionizedAssessment &&
      sectionConfig &&
      Array.isArray(sectionConfig) &&
      sectionConfig.some((s) => s?.weight_percent && s.weight_percent > 0)

    let newScore: number
    if (useWeightedSections) {
      // Get all questions with their effective points (override_points or points_earned)
      const breakdown = await sql`
        SELECT qq.id, qq.question_type,
               COALESCE(qq.max_points, qq.points, 1) as max_points,
               COALESCE(qa.override_points, qa.points_earned, 0) as effective_points
        FROM quiz_questions qq
        LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${answer.attempt_id}
        WHERE qq.quiz_id = ${quizId}
        ORDER BY qq.question_order ASC NULLS LAST, qq.id ASC
      `
      const sections = groupQuestionsBySections(
        (breakdown as any[]).map((q) => ({ question_type: q.question_type })),
        sectionConfig
      )
      const sectionScores = sections.map((s) => {
        let earned = 0
        let max = 0
        for (const idx of s.questionIndices) {
          const q = (breakdown as any[])[idx]
          if (!q) continue
          earned += Number(q.effective_points ?? 0)
          max += Number(q.max_points ?? 1)
        }
        return { earned, max, weightPercent: s.weightPercent }
      })
      newScore = Math.round(calculateWeightedScore(sectionScores) * 100) / 100
    } else {
      const scoreResult = await sql`
        SELECT COALESCE(SUM(COALESCE(override_points, points_earned, 0)), 0) as new_score
        FROM quiz_answers
        WHERE attempt_id = ${answer.attempt_id}
      `
      newScore = parseFloat(scoreResult[0]?.new_score || 0)
    }

    await sql`
      UPDATE quiz_attempts
      SET score = ${newScore},
          total_score_override = NULL
      WHERE id = ${answer.attempt_id}
    `

    await syncGradebookForAttempt(answer.attempt_id)

    return NextResponse.json({
      success: true,
      answerId,
      pointsEarned,
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
