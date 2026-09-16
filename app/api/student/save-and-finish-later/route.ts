import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hasSaveAndFinishLaterAccess, getSaveAndFinishLaterLimit } from "@/lib/retake-access"
import { ensureSectionTimerSchema } from "@/lib/ensure-section-timer-schema"
import { sanitizeAttemptTimerState } from "@/lib/sanitize-attempt-timer-state"
import { parseAssessmentSectionConfig } from "@/lib/assessment-sections"
export const dynamic = "force-dynamic"

/**
 * POST /api/student/save-and-finish-later
 *
 * Saves current quiz progress and marks attempt for resume later.
 * Only available for Explorer and Trailblazer memberships.
 *
 * Body: { attemptId, currentQuestionIndex?, remainingTimeSeconds? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      attemptId,
      currentQuestionIndex,
      remainingTimeSeconds,
      questionTimeRemaining,
      sectionTimeRemaining,
    } = body

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    const attemptIdNum = parseInt(String(attemptId), 10)
    if (isNaN(attemptIdNum) || attemptIdNum <= 0) {
      return NextResponse.json({ error: "Invalid attemptId" }, { status: 400 })
    }

    // Get attempt and verify student
    const attemptRows = await sql`
      SELECT id, student_id, quiz_id, completed_at, saved_for_later_at
      FROM quiz_attempts
      WHERE id = ${attemptIdNum} AND deleted_at IS NULL
      LIMIT 1
    `

    if (attemptRows.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attemptRows[0]
    if (attempt.completed_at) {
      return NextResponse.json(
        { error: "Attempt already submitted" },
        { status: 400 }
      )
    }

    // Check membership: only Explorer/Trailblazer
    const hasAccess = await hasSaveAndFinishLaterAccess(attempt.student_id)
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Save and Finish Later is only available with Explorer or Trailblazer membership.",
          upgradeRequired: "Explorer",
        },
        { status: 403 }
      )
    }

    // Check limit: Explorer = 3 in-progress max, Trailblazer = unlimited
    const limit = await getSaveAndFinishLaterLimit(attempt.student_id)
    if (limit !== null && limit > 0) {
      const isUpdatingExisting = !!attempt.saved_for_later_at
      if (!isUpdatingExisting) {
        const countResult = await sql`
          SELECT COUNT(*)::int as count
          FROM quiz_attempts
          WHERE student_id = ${attempt.student_id}
            AND deleted_at IS NULL
            AND completed_at IS NULL
            AND saved_for_later_at IS NOT NULL
        `
        const currentCount = countResult[0]?.count ?? 0
        if (currentCount >= limit) {
          return NextResponse.json(
            {
              error: `You've reached your limit of ${limit} saved assessments. Upgrade to Trailblazer for unlimited.`,
              upgradeRequired: "Trailblazer",
            },
            { status: 403 }
          )
        }
      }
    }

    // Update attempt: set saved_for_later_at, last_saved_at, optionally current_question_index and remaining_time
    const idx =
      typeof currentQuestionIndex === "number" && currentQuestionIndex >= 0
        ? currentQuestionIndex
        : null
    const rem =
      typeof remainingTimeSeconds === "number" && remainingTimeSeconds >= 0
        ? remainingTimeSeconds
        : null

    let questionTimeJson: string | null = null
    let sectionTimeJson: string | null = null
    if (
      questionTimeRemaining &&
      typeof questionTimeRemaining === "object" &&
      sectionTimeRemaining &&
      typeof sectionTimeRemaining === "object"
    ) {
      await ensureSectionTimerSchema()
      const quizRows = await sql`
        SELECT q.section_config, q.assessment_type, qq.id, qq.question_type, qq.question_order
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        INNER JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE qa.id = ${attemptIdNum}
        ORDER BY qq.question_order ASC
      `
      if (quizRows.length > 0) {
        const sectionConfig = parseAssessmentSectionConfig(quizRows[0].section_config)
        const assessmentType = quizRows[0].assessment_type as string | null
        const questions = quizRows.map((r) => ({
          id: Number(r.id),
          question_type: r.question_type as string | null,
          question_order: r.question_order as number | null,
        }))
        const sanitized = sanitizeAttemptTimerState(
          questions,
          sectionConfig,
          questionTimeRemaining as Record<string, number>,
          sectionTimeRemaining as Record<string, number>,
          { fillMissingToFull: false },
          assessmentType,
        )
        questionTimeJson = JSON.stringify(sanitized.questionTimeRemaining)
        sectionTimeJson = JSON.stringify(sanitized.sectionTimeRemaining)
      }
    }

    await sql`
      UPDATE quiz_attempts
      SET 
        saved_for_later_at = NOW(),
        last_saved_at = NOW(),
        current_question_index = COALESCE(${idx}, current_question_index),
        remaining_time = COALESCE(${rem}, remaining_time),
        question_time_remaining = COALESCE(${questionTimeJson}::jsonb, question_time_remaining),
        section_time_remaining = COALESCE(${sectionTimeJson}::jsonb, section_time_remaining)
      WHERE id = ${attemptIdNum} AND completed_at IS NULL
    `

    return NextResponse.json({
      success: true,
      message: "Progress saved. You can resume this assessment later.",
    })
  } catch (error) {
    console.error("[save-and-finish-later] Error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save progress",
      },
      { status: 500 }
    )
  }
}
