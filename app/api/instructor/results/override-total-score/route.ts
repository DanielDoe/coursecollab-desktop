import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { syncGradebookForAttempt } from "@/lib/grades"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import {
  isMidSemesterOverrideType,
  usesWeightedPercentageDisplay,
} from "@/lib/instructor-score-override"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/results/override-total-score
 * Body: { attemptId: number, score: number, assessmentType?: string }
 * - For mid_semester and section-weighted finals: score is percentage 0–100 (matches results display).
 * - For other types: score is raw points, capped at quiz total points.
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const attemptId = typeof body.attemptId === "string" ? parseInt(body.attemptId, 10) : Number(body.attemptId)
    const rawScore = typeof body.score === "string" ? parseFloat(body.score) : Number(body.score)
    const assessmentType = typeof body.assessmentType === "string" ? body.assessmentType : ""

    if (!attemptId || Number.isNaN(attemptId) || attemptId <= 0) {
      return NextResponse.json({ error: "Valid attemptId is required" }, { status: 400 })
    }
    if (Number.isNaN(rawScore) || rawScore < 0) {
      return NextResponse.json({ error: "Valid non-negative score is required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT
        qa.id,
        qa.quiz_id,
        qa.score as previous_score,
        q.assessment_type,
        q.section_config,
        (SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0)::numeric
         FROM quiz_questions qq WHERE qq.quiz_id = q.id) as total_points
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = ${attemptId}
        AND qa.deleted_at IS NULL
        AND q.deleted_at IS NULL
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const row = rows[0] as {
      quiz_id: number
      previous_score: string | number
      assessment_type: string | null
      total_points: string | number
      section_config: unknown
    }
    const previousScore = Number(row.previous_score) || 0
    const totalPoints = Math.max(0, parseFloat(String(row.total_points)))

    const effectiveType = row.assessment_type || "quiz"
    const usePercentageScale =
      isMidSemesterOverrideType(effectiveType, assessmentType) ||
      usesWeightedPercentageDisplay(effectiveType, row.section_config)

    let storedScore: number
    let percentage: number

    if (usePercentageScale) {
      const pct = Math.min(100, Math.max(0, rawScore))
      storedScore = Math.round(pct * 100) / 100
      percentage = storedScore
      await sql`
        UPDATE quiz_attempts
        SET score = ${storedScore},
            total_score_override = ${storedScore},
            completed_at = COALESCE(
              completed_at,
              NOW()
            )
        WHERE id = ${attemptId}
      `
    } else {
      const cap = totalPoints > 0 ? totalPoints : rawScore
      if (totalPoints > 0 && rawScore > totalPoints) {
        return NextResponse.json(
          { error: `Score cannot exceed ${totalPoints} points for this assessment` },
          { status: 400 }
        )
      }
      storedScore = Math.round(Math.min(rawScore, cap) * 100) / 100
      percentage =
        totalPoints > 0 ? Math.round((storedScore / totalPoints) * 10000) / 100 : 0

      await sql`
        UPDATE quiz_attempts
        SET score = ${storedScore},
            total_score_override = ${storedScore},
            completed_at = COALESCE(
              completed_at,
              NOW()
            )
        WHERE id = ${attemptId}
      `
    }

    await syncGradebookForAttempt(attemptId)

    const instructorLabel =
      request.headers.get("x-instructor-name")?.trim() ||
      request.headers.get("x-instructor-id")?.trim() ||
      "Instructor"
    await recordAttemptScoreChange({
      attemptId,
      previousScore,
      newScore: storedScore,
      totalPoints: usePercentageScale ? 100 : totalPoints,
      source: "instructor_total_override",
      actorType: "instructor",
      actorId: request.headers.get("x-instructor-id"),
      actorLabel: instructorLabel,
      reason: "Instructor manually adjusted total score",
    })

    return NextResponse.json({
      success: true,
      attemptId,
      score: storedScore,
      percentage,
      totalPoints: usePercentageScale ? 100 : totalPoints,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update score"
    console.error("[override-total-score]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
