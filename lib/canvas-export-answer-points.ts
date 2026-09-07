import { reconcileStoredQuestionPointsForDisplay } from "@/lib/ai-points-consistency"

/** Question template from `quiz_questions` (one row per question in the quiz). */
export type InstructorAlignQuestion = {
  question_id: number
  question_order: number | null
  question_type?: string | null
  max_points: number
  points: number
  points_earned?: number | null
  is_correct?: boolean
  ai_feedback?: unknown
  override_points?: number | null
}

/** Answer row for an attempt (may be orphaned — no matching `quiz_questions` row). */
export type AnswerForInstructorAlign = {
  answer_id: number
  question_id: number
  question_order: number
  override_points: number | null
  points_earned: number | null
  is_correct: boolean | null
  ai_feedback: unknown
}

/** Same cap as instructor `effectivePointsFromQuestionRow` after reconcile. */
function effectivePointsFromQuestionRow(q: {
  override_points?: number | null
  points_earned?: number | null
  max_points?: number
  points?: number
}): number {
  const max = Number(q.max_points || q.points || 1)
  const raw = q.override_points != null ? Number(q.override_points) : Number(q.points_earned ?? 0)
  return Math.min(Math.max(0, raw), max > 0 ? max : 1)
}

function parseQuestionAiFeedback(q: { ai_feedback?: unknown }): void {
  if (q.ai_feedback && typeof q.ai_feedback === "string") {
    try {
      q.ai_feedback = JSON.parse(q.ai_feedback)
    } catch {
      /* leave string */
    }
  }
}

/**
 * Same headline total as instructor results view: merge answers by `question_id` then by position for
 * orphans, parse `ai_feedback`, `reconcileStoredQuestionPointsForDisplay`, sum capped points.
 * Mutates `qList` (use a fresh copy per attempt).
 */
export function sumCanvasAttemptPointsLikeInstructorView(
  qList: InstructorAlignQuestion[],
  aList: AnswerForInstructorAlign[],
): number {
  const sortedQ = [...qList].sort(
    (a, b) => (Number(a.question_order) ?? 999) - (Number(b.question_order) ?? 999),
  )
  const questionIds = new Set(sortedQ.map((q) => String(q.question_id ?? "")))
  const byQuestionId = new Map<string, AnswerForInstructorAlign>()
  const orphaned: AnswerForInstructorAlign[] = []
  for (const a of aList) {
    const qid = a.question_id != null ? String(a.question_id) : ""
    if (qid && questionIds.has(qid)) {
      byQuestionId.set(qid, a)
    } else {
      orphaned.push(a)
    }
  }
  orphaned.sort(
    (x, y) =>
      (Number(x.question_order) ?? 999) - (Number(y.question_order) ?? 999) ||
      (Number(x.question_id) ?? 0) - (Number(y.question_id) ?? 0) ||
      (Number(x.answer_id) ?? 0) - (Number(y.answer_id) ?? 0),
  )
  let orphanIdx = 0
  for (const q of sortedQ) {
    const qid = q.question_id != null ? String(q.question_id) : ""
    let a = qid ? byQuestionId.get(qid) : undefined
    if (!a && orphanIdx < orphaned.length) {
      a = orphaned[orphanIdx++]
    }
    if (a) {
      const effectivePoints =
        a.override_points != null ? Number(a.override_points) : Number(a.points_earned ?? 0)
      q.points_earned = effectivePoints
      q.is_correct = a.is_correct === true
      q.ai_feedback = a.ai_feedback
      if (a.override_points != null) q.override_points = a.override_points
    }
  }

  const uniqueQuestions = Array.from(new Map(sortedQ.map((q) => [q.question_id, q])).values())
  const sortByQuestionOrder = (a: InstructorAlignQuestion, b: InstructorAlignQuestion) =>
    (Number(a.question_order) ?? 999) - (Number(b.question_order) ?? 999) ||
    (Number(a.question_id) ?? 0) - (Number(b.question_id) ?? 0)
  const questionsOrdered = [...uniqueQuestions].sort(sortByQuestionOrder)

  for (const q of questionsOrdered) {
    parseQuestionAiFeedback(q)
  }
  for (const q of questionsOrdered) {
    reconcileStoredQuestionPointsForDisplay(q)
  }

  return questionsOrdered.reduce((s, q) => s + effectivePointsFromQuestionRow(q), 0)
}
