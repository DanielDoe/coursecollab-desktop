import { sql } from "@/lib/db"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import {
  mergeCircuitSubmissionGrading,
  parseCircuitSubmissionAnswerMerged,
  resolveCircuitSubmissionInstructorGrading,
  resolveCircuitSubmissionProvisionalScore,
} from "@/lib/circuit-submission"
import { recalculateAttemptScore } from "@/lib/recalculate-score"

export type PromoteProvisionalCircuitResult = {
  promoted: number
  previewPoints: number
}

export type ReconcileFinalsCircuitGradesResult = PromoteProvisionalCircuitResult & {
  syncedOverrides: number
  syncedManual: number
}

async function recalcAttemptWithCooldown(attemptId: number, quizId: number): Promise<void> {
  try {
    await recalculateAttemptScore(attemptId, quizId, { allowScoreDecrease: false })
  } catch (e) {
    const name = e instanceof Error ? e.name : ""
    if (name !== "RecalculateRateLimitError") throw e
    await new Promise((r) => setTimeout(r, 5500))
    await recalculateAttemptScore(attemptId, quizId, { allowScoreDecrease: false })
  }
}

function finalizeCircuitAiFeedback(
  af: Record<string, unknown> | null,
  points: number,
  max: number,
): Record<string, unknown> {
  const base = af ? { ...af } : {}
  const rubricScores = base.rubricScoresPreview ?? base.rubricScores ?? null
  const finalized: Record<string, unknown> = {
    ...base,
    provisionalScore: false,
    requiresInstructorApproval: false,
    requiresManualReview: false,
    circuitSubmissionAiGraded: true,
    gradingOutcome: "graded",
    totalScore: points,
    rubricScores,
    pointsEarned: points,
    score: max > 0 ? Math.round((points / max) * 10000) / 100 : 0,
    finalizedAt: new Date().toISOString(),
  }
  delete finalized.rubricScoresPreview
  delete finalized.totalScorePreview
  return finalized
}

/**
 * Persist AI provisional circuit previews (totalScorePreview) as official points.
 * Used when results are finalized — instructor approval implied by finalize action.
 */
export async function promoteProvisionalCircuitScoresForAttempt(
  attemptId: number,
  finalizedBy?: string | null,
): Promise<PromoteProvisionalCircuitResult> {
  const attemptRows = await sql`
    SELECT quiz_id FROM quiz_attempts WHERE id = ${attemptId} AND deleted_at IS NULL LIMIT 1
  `
  if (attemptRows.length === 0) return { promoted: 0, previewPoints: 0 }
  const quizId = Number((attemptRows[0] as { quiz_id: number }).quiz_id)

  const rows = await sql`
    SELECT qa.id, qa.question_id, qa.points_earned, qa.override_points,
           qa.selected_answer, qa.answer_data, qa.ai_feedback,
           qq.question_type, COALESCE(qq.max_points, qq.points, 1) as max_points, qq.points
    FROM quiz_answers qa
    JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
    WHERE qa.attempt_id = ${attemptId}
      AND LOWER(qq.question_type) = 'circuit_submission'
  `

  let promoted = 0
  let previewPoints = 0

  for (const row of rows as any[]) {
    if (row.override_points != null && row.override_points !== undefined) continue
    if (Number(row.points_earned ?? 0) > 0.001) continue

    const preview = resolveCircuitSubmissionProvisionalScore(row)
    if (preview == null || preview <= 0) continue

    const af = flattenStoredAiFeedback(row.ai_feedback) as Record<string, unknown> | null
    if (!af) continue

    const max = Number(row.max_points || row.points || 1) || 1
    const points = parseFloat(Math.min(max, preview).toFixed(2))
    previewPoints += points

    const rubricScores = af.rubricScoresPreview ?? af.rubricScores ?? null
    const finalizedFeedback: Record<string, unknown> = {
      ...af,
      provisionalScore: false,
      requiresInstructorApproval: false,
      requiresManualReview: false,
      circuitSubmissionAiGraded: true,
      gradingOutcome: "graded",
      totalScore: preview,
      rubricScores,
      pointsEarned: points,
      score: max > 0 ? Math.round((points / max) * 10000) / 100 : 0,
      finalizedFromProvisional: true,
      finalizedAt: new Date().toISOString(),
      finalizedBy: finalizedBy ?? "system:provisional-promote",
    }
    delete finalizedFeedback.rubricScoresPreview
    delete finalizedFeedback.totalScorePreview

    const parsed = parseCircuitSubmissionAnswerMerged(row.selected_answer, row.answer_data)
    const merged = mergeCircuitSubmissionGrading(parsed, {
      manual_score: points,
      rubric_scores:
        rubricScores && typeof rubricScores === "object"
          ? (rubricScores as Record<string, number>)
          : null,
      graded_by: finalizedBy ?? "instructor:finalize",
      graded_at: new Date().toISOString(),
      submission_status: "graded",
    })

    await sql`
      UPDATE quiz_answers
      SET points_earned = ${points},
          is_correct = ${points >= max * 0.5},
          requires_review = false,
          ai_feedback = ${JSON.stringify(finalizedFeedback)}::jsonb,
          selected_answer = ${JSON.stringify(merged)},
          reviewed_by = ${finalizedBy ?? "system:provisional-promote"},
          reviewed_at = NOW()
      WHERE id = ${row.id}
    `
    promoted++
  }

  return { promoted, previewPoints }
}

/**
 * Sync TA/instructor override_points and manual_score from stored answer into points_earned
 * and finalize ai_feedback (fixes UI showing 0/1 when Behlool graded via override).
 */
export async function syncCircuitManualGradesForAttempt(
  attemptId: number,
  finalizedBy?: string | null,
): Promise<{ syncedOverrides: number; syncedManual: number }> {
  const attemptRows = await sql`
    SELECT quiz_id FROM quiz_attempts WHERE id = ${attemptId} AND deleted_at IS NULL LIMIT 1
  `
  if (attemptRows.length === 0) return { syncedOverrides: 0, syncedManual: 0 }
  const quizId = Number((attemptRows[0] as { quiz_id: number }).quiz_id)

  const rows = await sql`
    SELECT qa.id, qa.question_id, qa.points_earned, qa.override_points,
           qa.selected_answer, qa.answer_data, qa.ai_feedback, qa.requires_review,
           COALESCE(qq.max_points, qq.points, 1) as max_points, qq.points
    FROM quiz_answers qa
    JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
    WHERE qa.attempt_id = ${attemptId}
      AND LOWER(qq.question_type) = 'circuit_submission'
  `

  let syncedOverrides = 0
  let syncedManual = 0

  for (const row of rows as any[]) {
    const max = Number(row.max_points || row.points || 1) || 1
    const currentPts = Number(row.points_earned ?? 0)
    const af = flattenStoredAiFeedback(row.ai_feedback) as Record<string, unknown> | null
    const outcome = af?.gradingOutcome

    if (row.override_points != null && row.override_points !== undefined) {
      const overridePts = parseFloat(
        Math.min(max, Math.max(0, Number(row.override_points))).toFixed(2),
      )
      if (Math.abs(currentPts - overridePts) > 0.001 || outcome === "instructor_review" || row.requires_review) {
        const finalizedFeedback = finalizeCircuitAiFeedback(af, overridePts, max)
        finalizedFeedback.finalizedBy = finalizedBy ?? "system:override-sync"
        const parsed = parseCircuitSubmissionAnswerMerged(row.selected_answer, row.answer_data)
        const merged = mergeCircuitSubmissionGrading(parsed, {
          manual_score: overridePts,
          graded_by: parsed.graded_by ?? finalizedBy ?? "instructor",
          graded_at: new Date().toISOString(),
          submission_status: "graded",
        })
        await sql`
          UPDATE quiz_answers
          SET points_earned = ${overridePts},
              is_correct = ${overridePts >= max * 0.5},
              requires_review = false,
              ai_feedback = ${JSON.stringify(finalizedFeedback)}::jsonb,
              selected_answer = ${JSON.stringify(merged)}
          WHERE id = ${row.id}
        `
        syncedOverrides++
      }
      continue
    }

    const { suggestedScore, parsed } = resolveCircuitSubmissionInstructorGrading({
      selectedAnswer: row.selected_answer,
      answerData: row.answer_data,
      aiFeedback: row.ai_feedback,
      pointsEarned: row.points_earned,
      overridePoints: row.override_points,
    })
    const manualFromAnswer =
      parsed.manual_score != null && parsed.manual_score > 0 ? parsed.manual_score : null
    const candidate = manualFromAnswer ?? (suggestedScore > 0 ? suggestedScore : null)
    if (candidate == null || currentPts > 0.001) continue
    if (outcome === "graded" || outcome === "missing_submission") continue

    const points = parseFloat(Math.min(max, candidate).toFixed(2))
    const finalizedFeedback = finalizeCircuitAiFeedback(af, points, max)
    finalizedFeedback.finalizedBy = finalizedBy ?? "system:manual-sync"
    const merged = mergeCircuitSubmissionGrading(parsed, {
      manual_score: points,
      graded_by: parsed.graded_by ?? finalizedBy ?? "instructor",
      graded_at: new Date().toISOString(),
      submission_status: "graded",
    })
    await sql`
      UPDATE quiz_answers
      SET points_earned = ${points},
          override_points = ${points},
          is_correct = ${points >= max * 0.5},
          requires_review = false,
          ai_feedback = ${JSON.stringify(finalizedFeedback)}::jsonb,
          selected_answer = ${JSON.stringify(merged)}
      WHERE id = ${row.id}
    `
    syncedManual++
  }

  return { syncedOverrides, syncedManual }
}

/** Promote provisional AI previews + sync TA manual overrides, then recalc attempt score. */
export async function reconcileFinalExamCircuitGradesForAttempt(
  attemptId: number,
  finalizedBy?: string | null,
): Promise<ReconcileFinalsCircuitGradesResult> {
  const attemptRows = await sql`
    SELECT quiz_id FROM quiz_attempts WHERE id = ${attemptId} AND deleted_at IS NULL LIMIT 1
  `
  if (attemptRows.length === 0) {
    return { promoted: 0, previewPoints: 0, syncedOverrides: 0, syncedManual: 0 }
  }
  const quizId = Number((attemptRows[0] as { quiz_id: number }).quiz_id)

  const promoted = await promoteProvisionalCircuitScoresForAttempt(attemptId, finalizedBy)
  const synced = await syncCircuitManualGradesForAttempt(attemptId, finalizedBy)

  if (promoted.promoted > 0 || synced.syncedOverrides > 0 || synced.syncedManual > 0) {
    await recalcAttemptWithCooldown(attemptId, quizId)
  }

  return { ...promoted, ...synced }
}
