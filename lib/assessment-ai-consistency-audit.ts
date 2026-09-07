/**
 * Audit helpers for AI-graded homework/quiz answers (quiz_answers).
 * Excludes instructor-adjusted rows (override_points IS NOT NULL).
 */

import {
  getCanonicalAiFeedbackPercent,
  reconcileStoredQuestionPointsForDisplay,
} from "@/lib/ai-points-consistency"
import {
  REFERENCE_ANSWER_FEEDBACK_MARKER,
  resolveReferenceAnswerForAiGrading,
  withReferenceAnswerFeedbackHeader,
  type QuestionWithReferenceFields,
} from "@/lib/resolve-reference-answer-for-ai"
import { resolveQuizQuestionFromBank, type QuizQuestionRow } from "@/lib/resolve-quiz-question-from-bank"

export const AI_GRADED_QUESTION_TYPES = new Set([
  "code_write",
  "code_problem",
  "debug_code",
  "code_explain",
  "code_write_plot",
  "code_debug",
  "multi_part",
  "circuit_submission",
  "circuit_worked_solution",
  "circuit_analysis",
  "short_answer",
  "long_answer",
  "numeric",
  "fill_blank",
])

export type AssessmentAiIssueKind =
  | "missing_reference_answer"
  | "points_drift"
  | "missing_feedback_header"
  | "zero_points_with_ai_score"
  | "ai_not_graded"

export type AssessmentAiIssue = {
  kind: AssessmentAiIssueKind
  answerId: number
  attemptId: number
  questionId: number
  quizId: number
  assessmentType: string
  questionType: string
  studentId?: number
  details: string
  referenceAnswer?: string | null
  storedPoints?: number
  expectedPoints?: number
  aiPercent?: number | null
}

export type AssessmentAnswerAuditRow = {
  answer_id: number
  attempt_id: number
  question_id: number
  quiz_id: number
  assessment_type: string
  question_type: string
  student_id?: number
  points_earned: number | null
  override_points: number | null
  max_points?: number | null
  question_points?: number | null
  ai_feedback: unknown
  expected_answer?: string | null
  sample_answer?: string | null
  correct_answer?: unknown
  circuit_spec?: unknown
  bank_expected_answer?: string | null
  bank_sample_answer?: string | null
  [key: string]: unknown
}

function parseAiFeedback(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

export function resolveQuestionForAudit(row: AssessmentAnswerAuditRow): QuizQuestionRow {
  return resolveQuizQuestionFromBank(row as QuizQuestionRow)
}

export function auditAssessmentAnswerRow(row: AssessmentAnswerAuditRow): AssessmentAiIssue[] {
  if (row.override_points != null) return []

  const qt = String(row.question_type ?? "").toLowerCase()
  if (!AI_GRADED_QUESTION_TYPES.has(qt)) return []

  const question = resolveQuestionForAudit(row)
  const referenceAnswer = resolveReferenceAnswerForAiGrading(question)
  const maxPts = Number(row.max_points ?? row.question_points ?? 1) || 1
  const issues: AssessmentAiIssue[] = []

  const base = {
    answerId: Number(row.answer_id),
    attemptId: Number(row.attempt_id),
    questionId: Number(row.question_id),
    quizId: Number(row.quiz_id),
    assessmentType: String(row.assessment_type ?? ""),
    questionType: qt,
    studentId: row.student_id != null ? Number(row.student_id) : undefined,
    referenceAnswer,
  }

  const af = parseAiFeedback(row.ai_feedback)
  const aiGraded =
    af?.aiGraded === true ||
    af?.circuitSubmissionAiGraded === true ||
    af?.multiPartAiGraded === true ||
    getCanonicalAiFeedbackPercent(af) != null

  if (!aiGraded && Number(row.points_earned ?? 0) > 0 && qt !== "multi_part") {
    /* may be locally verified — skip */
  } else if (!aiGraded && (af?.feedback || af?.errorType)) {
    issues.push({
      ...base,
      kind: "ai_not_graded",
      details: "Has AI feedback payload but aiGraded flag missing or false",
    })
  }

  if (
    ["circuit_submission", "multi_part", "code_write", "code_problem", "short_answer", "long_answer"].includes(qt) &&
    !referenceAnswer
  ) {
    issues.push({
      ...base,
      kind: "missing_reference_answer",
      details: "No canonical reference answer configured for AI-graded question",
    })
  }

  const displayRow = {
    question_type: qt,
    points_earned: row.points_earned,
    override_points: row.override_points,
    max_points: maxPts,
    points: maxPts,
    ai_feedback: af,
  }
  reconcileStoredQuestionPointsForDisplay(displayRow)
  const expectedPoints = Number(displayRow.points_earned ?? 0)
  const storedPoints = Number(row.points_earned ?? 0)
  const aiPercent = getCanonicalAiFeedbackPercent(af)

  if (Math.abs(expectedPoints - storedPoints) > 0.02) {
    // Only flag under-credit; attempt-floor / instructor generosity may award above AI %
    if (expectedPoints < storedPoints - 0.02) {
      /* stored higher than AI — acceptable */
    } else {
      issues.push({
        ...base,
        kind: "points_drift",
        details: `Stored ${storedPoints} pts vs AI-implied ${expectedPoints} pts (${aiPercent ?? "?"}%)`,
        storedPoints,
        expectedPoints,
        aiPercent,
      })
    }
  }

  if (referenceAnswer && af?.feedback) {
    const feedback = String(af.feedback)
    if (!feedback.includes(REFERENCE_ANSWER_FEEDBACK_MARKER)) {
      issues.push({
        ...base,
        kind: "missing_feedback_header",
        details: "AI feedback missing shared reference-answer header",
      })
    }
  }

  if (
    storedPoints <= 0 &&
    aiPercent != null &&
    aiPercent > 0 &&
    qt !== "multi_part"
  ) {
    issues.push({
      ...base,
      kind: "zero_points_with_ai_score",
      details: `0 stored points but AI reports ${aiPercent}%`,
      storedPoints,
      expectedPoints,
      aiPercent,
    })
  }

  return issues
}

export function summarizeAssessmentAiIssues(issues: AssessmentAiIssue[]) {
  const byKind: Record<string, number> = {}
  for (const i of issues) {
    byKind[i.kind] = (byKind[i.kind] ?? 0) + 1
  }
  return byKind
}

/** Flag questions where AI percent spread is unusually high (same question, many students). */
export function findHighVarianceQuestions(
  rows: AssessmentAnswerAuditRow[],
  minStudents = 3,
  spreadThreshold = 40,
): Array<{ questionId: number; quizId: number; spread: number; count: number; percents: number[] }> {
  const byQuestion = new Map<number, number[]>()
  for (const row of rows) {
    if (row.override_points != null) continue
    const af = parseAiFeedback(row.ai_feedback)
    const pct = getCanonicalAiFeedbackPercent(af)
    if (pct == null) continue
    const qid = Number(row.question_id)
    if (!byQuestion.has(qid)) byQuestion.set(qid, [])
    byQuestion.get(qid)!.push(pct)
  }
  const out: Array<{ questionId: number; quizId: number; spread: number; count: number; percents: number[] }> = []
  for (const [questionId, percents] of byQuestion) {
    if (percents.length < minStudents) continue
    const min = Math.min(...percents)
    const max = Math.max(...percents)
    const spread = max - min
    if (spread >= spreadThreshold) {
      const sample = rows.find((r) => Number(r.question_id) === questionId)
      out.push({
        questionId,
        quizId: Number(sample?.quiz_id ?? 0),
        spread,
        count: percents.length,
        percents,
      })
    }
  }
  return out.sort((a, b) => b.spread - a.spread)
}

/** Normalize AI feedback before persisting so all students see the same reference solution header. */
export function normalizeAssessmentAiFeedbackForStorage(
  question: QuestionWithReferenceFields | null | undefined,
  aiFeedback: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!aiFeedback || typeof aiFeedback !== "object") return aiFeedback ?? null
  const referenceAnswer = resolveReferenceAnswerForAiGrading(question)
  const out = { ...aiFeedback }
  if (out.aiGraded !== true && (out.feedback || out.score != null || out.scoreBreakdown)) {
    out.aiGraded = true
  }
  if (referenceAnswer && out.feedback) {
    out.feedback = withReferenceAnswerFeedbackHeader(String(out.feedback), referenceAnswer)
    out.referenceAnswer = referenceAnswer
  }
  return out
}

export { REFERENCE_ANSWER_FEEDBACK_MARKER }
