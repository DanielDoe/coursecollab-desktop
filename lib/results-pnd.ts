/**
 * Mirrors should_show_pnd logic from app/api/student/results/[id]/route.ts
 * so batch jobs can target the same "PND%" attempts as the student report.
 */
import { sql } from "@/lib/db"
import type { AssessmentTableConfig } from "@/lib/assessment-core/db"
import { isMultiPartUploadPendingReview } from "@/lib/multi-part-pnd"
import {
  isInstructorResolvedForPnd,
  isPendingManualReview,
} from "@/lib/question-pending-review"
import { hasCodeDataButZeroPoints } from "@/lib/student-answer-presence"

export { isInstructorResolvedForPnd } from "@/lib/question-pending-review"

export type QuestionRowForPnd = {
  question_type?: string
  points_earned?: number | null
  answer_data?: unknown
  selected_answer?: unknown
  requires_review?: boolean
  /** Instructor set a manual grade (including 0) — not pending for PND on that question. */
  override_points?: number | null
  /** Instructor reviewed (e.g. re-eval or manual review) — not pending for PND on that question. */
  reviewed_by?: string | null
  reviewed_at?: string | null
  is_correct?: boolean | null
}

/** Points that count for “still pending?” — override wins over stored points_earned. */
function effectivePointsEarned(q: QuestionRowForPnd): number {
  if (q.override_points != null && q.override_points !== undefined) return Number(q.override_points)
  return Number(q.points_earned ?? 0)
}

/**
 * Derives the violation_log array consistent with PND rules (same as student report) and whether PND% should show.
 * Use `syncAttemptViolationLogFromPndRules` after re-grade to persist `violationLog`.
 */
export function deriveViolationLogAndShouldShowPnd(
  attempt: { violation_log?: unknown },
  questions: QuestionRowForPnd[]
): { shouldShowPnd: boolean; violationLog: unknown[] } {
  const hasTypingOrCodeButZeroPts = questions.some((q) => {
    if (isInstructorResolvedForPnd(q)) return false
    // Once a question has a positive score, it is not “data but 0 pts” pending (stale rows may have wrong points_earned until reconcile).
    if (effectivePointsEarned(q) > 0) return false
    return hasCodeDataButZeroPoints(q)
  })
  const hasMultiPartUploadPending = questions.some(
    (q) => !isInstructorResolvedForPnd(q) && isMultiPartUploadPendingReview(q),
  )
  const hasReviewableAnswer = questions.some((q) => isPendingManualReview(q))
  const hasAnyReviewableIssue =
    hasTypingOrCodeButZeroPts || hasReviewableAnswer || hasMultiPartUploadPending

  let violationLog: unknown[] = Array.isArray(attempt.violation_log) ? [...attempt.violation_log] : []
  if (
    hasTypingOrCodeButZeroPts &&
    !violationLog.some((e: any) => e?.type === "score_pending" || e?.type === "evaluation_failed")
  ) {
    violationLog = [
      ...violationLog,
      {
        type: "score_pending",
        reason: "data_but_zero_points",
        timestamp: new Date().toISOString(),
        message:
          "Code question has saved data but 0 points—evaluation may have failed.",
      },
    ]
  }
  if (!hasAnyReviewableIssue) {
    violationLog = violationLog.filter(
      (e: any) => e?.type !== "score_pending" && e?.type !== "evaluation_failed"
    )
  } else if (!hasTypingOrCodeButZeroPts) {
    violationLog = violationLog.filter(
      (e: any) => !(e?.type === "score_pending" && e?.reason === "data_but_zero_points")
    )
  }

  // submission_stalled is historical (network) — show in violation_log UI, but do not keep PND% on the score forever.
  const shouldShowPnd =
    hasTypingOrCodeButZeroPts ||
    (violationLog.some((e: any) => e?.type === "score_pending" || e?.type === "evaluation_failed") &&
      hasAnyReviewableIssue)

  return { shouldShowPnd, violationLog }
}

export function computeShouldShowPnd(
  attempt: { violation_log?: unknown },
  questions: QuestionRowForPnd[]
): boolean {
  return deriveViolationLogAndShouldShowPnd(attempt, questions).shouldShowPnd
}

/**
 * Recomputes PND for many attempts using the same rules as computeShouldShowPnd (student + list alignment).
 * Use after SQL list heuristics to drop false positives (e.g. requires_review with no real answer content).
 */
export async function batchComputeShouldShowPnd(
  attemptIds: number[],
  config: AssessmentTableConfig
): Promise<Map<number, boolean>> {
  const out = new Map<number, boolean>()
  if (attemptIds.length === 0) return out

  const attempts = await sql`
    SELECT id, violation_log
    FROM ${sql.unsafe(config.attemptsTable)}
    WHERE id = ANY(${attemptIds}::int[])
  `
  const byId = new Map<number, { violation_log?: unknown }>()
  for (const row of attempts as { id: number; violation_log?: unknown }[]) {
    byId.set(Number(row.id), { violation_log: row.violation_log })
  }

  const rows = await sql`
    SELECT DISTINCT ON (att.id, qq.id)
      att.id as attempt_id,
      qq.question_type,
      COALESCE(qa.override_points, qa.points_earned, 0) as points_earned,
      qa.answer_data,
      qa.selected_answer,
      COALESCE(qa.requires_review, false) as requires_review,
      qa.override_points,
      qa.reviewed_by,
      qa.reviewed_at,
      qa.is_correct
    FROM ${sql.unsafe(config.attemptsTable)} att
    JOIN ${sql.unsafe(config.questionsTable)} qq ON qq.${sql.unsafe(config.idColumn)} = att.${sql.unsafe(config.idColumn)}
    LEFT JOIN ${sql.unsafe(config.answersTable)} qa ON qa.question_id = qq.id AND qa.attempt_id = att.id
    WHERE att.id = ANY(${attemptIds}::int[])
    ORDER BY att.id, qq.id, COALESCE(qa.override_points, qa.points_earned) DESC NULLS LAST
  `

  const questionsByAttempt = new Map<number, QuestionRowForPnd[]>()
  for (const row of rows as any[]) {
    const aid = Number(row.attempt_id)
    const list = questionsByAttempt.get(aid) ?? []
    list.push({
      question_type: row.question_type,
      points_earned: row.points_earned != null ? Number(row.points_earned) : 0,
      answer_data: row.answer_data,
      selected_answer: row.selected_answer,
      requires_review: row.requires_review === true,
      override_points: row.override_points != null ? Number(row.override_points) : null,
      reviewed_by: row.reviewed_by ?? null,
      reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
      is_correct: row.is_correct === true ? true : row.is_correct === false ? false : null,
    })
    questionsByAttempt.set(aid, list)
  }

  for (const id of attemptIds) {
    const att = byId.get(id) ?? { violation_log: [] }
    const qs = questionsByAttempt.get(id) ?? []
    out.set(id, computeShouldShowPnd(att, qs))
  }

  return out
}
