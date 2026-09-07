/**
 * Keeps awarded points aligned with AI-reported percentage for code / AI-graded items.
 * Prefer canonical score (0–100) over ambiguous `points` / `pointsEarned` from clients or LLM JSON.
 */

import {
  applyAttemptMinimumFloorToPointsEarned,
  extractTextForAttemptFloorCheck,
  syncAiFeedbackObjectToPointsEarned,
} from "@/lib/ai-code-attempt-floor"
import {
  resolveCircuitSubmissionInstructorGrading,
  sumCircuitSubmissionRubricScores,
  type CircuitSubmissionRubricScores,
} from "@/lib/circuit-submission"
import { applyCircuitDisplayScoreFloor } from "@/lib/circuit-submission-grading-policy"

const AI_CODE_QUESTION_TYPES = new Set([
  "code_write",
  "code_problem",
  "debug_code",
  "code_explain",
  "code_write_plot",
  "code_debug",
])

const MULTI_PART_QT = "multi_part"

/** Interpret AI score: 0–100 as percent; (0,1] non-integers as fraction of 100; 1 → 100%. */
export function normalizeAiPercentScore(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  if (n === 0) return 0
  // >1 must be 0–100 scale (e.g. 70 = 70%)
  if (n > 1) return Math.max(0, Math.min(100, n))
  // 0 < n <= 1: treat as fraction (0.7 → 70%). Integer 1 → 100%.
  return Math.max(0, Math.min(100, n * 100))
}

function finalScoreFromFeedback(aiFeedback: Record<string, unknown> | null | undefined): number | null {
  if (!aiFeedback || typeof aiFeedback !== "object") return null
  const sb = aiFeedback.scoreBreakdown as { finalScore?: unknown } | undefined
  if (sb && sb.finalScore != null) {
    const p = normalizeAiPercentScore(sb.finalScore)
    if (p != null) return p
  }
  if (aiFeedback.score != null) return normalizeAiPercentScore(aiFeedback.score)
  return null
}

/**
 * **Display / points source of truth:** same % used by `reconcileStoredQuestionPointsForDisplay`.
 * Prefers `scoreBreakdown.finalScore` over top-level `score` when present — the latter is often a stale
 * raw code-quality figure while finalScore reflects penalties and the grade that matches `points_earned`.
 */
export function getCanonicalAiFeedbackPercent(aiFeedback: unknown): number | null {
  if (!aiFeedback || typeof aiFeedback !== "object") return null
  return finalScoreFromFeedback(aiFeedback as Record<string, unknown>)
}

function isAiGradedPayload(
  questionType: string | undefined,
  aiFeedback: Record<string, unknown> | null | undefined
): boolean {
  const qt = (questionType || "").toLowerCase()
  if (AI_CODE_QUESTION_TYPES.has(qt)) return true
  if (qt === MULTI_PART_QT) {
    if (!aiFeedback || typeof aiFeedback !== "object") return false
    if (aiFeedback.multiPartMcqGraded === true) return true
    if (aiFeedback.uploadPending === true) return false
    return aiFeedback.multiPartAiGraded === true
  }
  if (!aiFeedback || typeof aiFeedback !== "object") return false
  return (
    aiFeedback.aiGraded === true ||
    aiFeedback.score != null ||
    (typeof aiFeedback.scoreBreakdown === "object" && aiFeedback.scoreBreakdown != null)
  )
}

/**
 * Single source of truth before persisting: if we have an AI %, awarded = (pct/100) * maxPoints.
 */
export function resolveAwardedPointsForAiSubmission(args: {
  questionType: string | undefined
  questionMaxPoints: number
  tentativePoints: number
  bodyScore?: unknown
  aiFeedback?: Record<string, unknown> | null
  /** Quiz/homework/midsem/final mode — required with `rawAnswer` for submit-time attempt floor when client payloads omit synced scores */
  aiEvaluationMode?: string | null
  /** Request body `answer` — used for substantive-attempt length check */
  rawAnswer?: unknown
}): number {
  const maxPts = Math.max(0.0001, Number(args.questionMaxPoints) || 1)
  const tentative = Math.max(0, Number(args.tentativePoints) || 0)

  const qt = (args.questionType || "").toLowerCase()
  const af = args.aiFeedback ?? null

  if (!isAiGradedPayload(args.questionType, af)) {
    return parseFloat(Math.min(tentative, maxPts).toFixed(2))
  }

  // Multi-part: MCQ pts + finalized upload pts (rubric tiers), not overall % alone.
  if (qt === MULTI_PART_QT && af && typeof af === "object") {
    const mcq = Number(af.mcqEarned)
    if (af.multiPartAiGraded === true) {
      const upload = Number(af.uploadPointsEarned)
      if (Number.isFinite(mcq) && Number.isFinite(upload)) {
        return parseFloat(Math.min(maxPts, Math.max(0, mcq + upload)).toFixed(2))
      }
    } else if (af.multiPartMcqGraded === true && Number.isFinite(mcq)) {
      return parseFloat(Math.min(maxPts, Math.max(0, mcq)).toFixed(2))
    }
  }

  if (qt === "circuit_submission" && af && typeof af === "object") {
    if (af.circuitSubmissionAiGraded === true) {
      const total = Number(af.totalScore)
      if (Number.isFinite(total) && total > 0) {
        return parseFloat(Math.min(maxPts, Math.max(0, total)).toFixed(2))
      }
    }
    if (af.provisionalScore === true || af.requiresInstructorApproval === true) {
      return parseFloat(Math.min(maxPts, Math.max(0, tentative)).toFixed(2))
    }
    const preview = Number(af.totalScorePreview ?? af.totalScore)
    const rubricRaw = af.rubricScores ?? af.rubricScoresPreview
    const rubricSum =
      rubricRaw && typeof rubricRaw === "object"
        ? sumCircuitSubmissionRubricScores(rubricRaw as CircuitSubmissionRubricScores)
        : 0
    const candidate = Math.max(
      Number.isFinite(preview) ? preview : 0,
      Number.isFinite(rubricSum) ? rubricSum : 0,
    )
    if (candidate > 0 && (af.aiGraded === true || typeof af.feedback === "string")) {
      const floored = applyCircuitDisplayScoreFloor(candidate, maxPts, af)
      return parseFloat(Math.min(maxPts, floored).toFixed(2))
    }
  }

  const pct = finalScoreFromFeedback(af) ?? normalizeAiPercentScore(args.bodyScore)

  let out: number
  if (pct != null) {
    out = parseFloat(Math.min(maxPts, Math.max(0, (pct / 100) * maxPts)).toFixed(2))
  } else {
    out = parseFloat(Math.min(tentative, maxPts).toFixed(2))
  }

  const modeRaw = args.aiEvaluationMode
  if (
    AI_CODE_QUESTION_TYPES.has(qt) &&
    modeRaw != null &&
    String(modeRaw).trim() !== "" &&
    args.rawAnswer !== undefined
  ) {
    const before = out
    out = applyAttemptMinimumFloorToPointsEarned({
      aiEvaluationMode: modeRaw,
      maxPoints: maxPts,
      answerTextForAttemptCheck: extractTextForAttemptFloorCheck(args.questionType, args.rawAnswer),
      pointsEarned: out,
      questionType: args.questionType,
    })
    if (
      out > before + 1e-6 &&
      args.aiFeedback &&
      typeof args.aiFeedback === "object" &&
      !Array.isArray(args.aiFeedback)
    ) {
      syncAiFeedbackObjectToPointsEarned(args.aiFeedback as Record<string, unknown>, maxPts, out)
    }
  }

  return out
}

/**
 * Fix already-stored rows for reports: when DB points clearly disagree with ai_feedback.score.
 */
export function reconcileStoredQuestionPointsForDisplay(q: {
  question_type?: string
  points_earned?: number | null
  override_points?: number | null
  max_points?: number
  points?: number
  ai_feedback?: unknown
  answer_data?: unknown
  selected_answer?: unknown
}): void {
  if (q.override_points != null) return

  const qtEarly = (q.question_type || "").toLowerCase()
  if (qtEarly === "circuit_submission" && Number(q.points_earned ?? 0) <= 0) {
    const af =
      q.ai_feedback && typeof q.ai_feedback === "object"
        ? (q.ai_feedback as Record<string, unknown>)
        : null
    if (af?.provisionalScore === true || af?.requiresInstructorApproval === true) return
    if (af?.circuitSubmissionAiGraded !== true) {
      const maxEarly = Number(q.max_points || q.points || 1) || 1
      const { suggestedScore } = resolveCircuitSubmissionInstructorGrading({
        selectedAnswer: q.selected_answer,
        answerData: q.answer_data,
        aiFeedback: q.ai_feedback,
        pointsEarned: q.points_earned,
        overridePoints: q.override_points,
      })
      if (suggestedScore > 0) {
        q.points_earned = parseFloat(Math.min(maxEarly, suggestedScore).toFixed(2))
        return
      }
    }
  }

  if (!isAiGradedPayload(q.question_type, q.ai_feedback as Record<string, unknown> | null)) return

  let af = q.ai_feedback
  if (typeof af === "string") {
    try {
      af = JSON.parse(af)
    } catch {
      return
    }
  }
  if (!af || typeof af !== "object") return

  const qt = (q.question_type || "").toLowerCase()
  const max = Number(q.max_points || q.points || 1) || 1
  const stored = Number(q.points_earned ?? 0)

  if (qt === "circuit_submission" && stored <= 0) {
    const obj = af as Record<string, unknown>
    if (obj.provisionalScore === true || obj.requiresInstructorApproval === true) return
    const total = Number(obj.totalScore ?? obj.totalScorePreview)
    const rubricRaw = obj.rubricScores ?? obj.rubricScoresPreview
    const rubricSum =
      rubricRaw && typeof rubricRaw === "object"
        ? sumCircuitSubmissionRubricScores(rubricRaw as CircuitSubmissionRubricScores)
        : 0
    const candidate = Math.max(Number.isFinite(total) ? total : 0, rubricSum)
    if (
      candidate > 0 &&
      (obj.circuitSubmissionAiGraded === true ||
        obj.aiGraded === true ||
        (typeof obj.feedback === "string" && obj.feedback.trim().length > 0))
    ) {
      q.points_earned = parseFloat(
        Math.min(max, applyCircuitDisplayScoreFloor(candidate, max, obj)).toFixed(2),
      )
      return
    }
  }

  const pct = finalScoreFromFeedback(af as Record<string, unknown>)
  if (pct == null) return

  const expected = parseFloat(((pct / 100) * max).toFixed(2))
  const impliedPct = max > 0 ? (stored / max) * 100 : 0
  // Tight tolerance: any visible mismatch between AI % and recorded points skews the report header vs feedback cards.
  const ptsDrift = Math.abs(stored - expected)
  const pctDrift = Math.abs(impliedPct - pct)
  if (ptsDrift > 0.01 + 1e-9 || pctDrift > 0.25 + 1e-9) {
    q.points_earned = expected
  }
}
