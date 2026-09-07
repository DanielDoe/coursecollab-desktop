/**
 * Multi-part engineering grading:
 * - X MCQ parts → up to X points (1 pt per correct part)
 * - Upload proof → up to (multiplier × X) points (default multiplier = 2)
 * - Total max = X × (1 + multiplier)
 */

import {
  getGradableSubquestions,
  gradeSubPart,
  parseMultiPartStudentAnswer,
  parseSubquestions,
  type MultiPartSubQuestion,
} from "@/lib/multi-part-question"
import type { QuestionSolutionUploadConfig } from "@/lib/solution-upload"
import { parseQuestionSolutionUploadConfig } from "@/lib/solution-upload"

export const SOLUTION_UPLOAD_PART_KEY = "solution_upload"

export const DEFAULT_UPLOAD_POINTS_MULTIPLIER = 2

export const STANDARD_SOLUTION_UPLOAD_PROMPT =
  "Upload your handwritten, scanned, tablet-written, MATLAB, MathScript, LTSpice, or digitally prepared solution showing all steps used to obtain your final answers."

export type MultiPartGradingPolicy = {
  part_count: number
  points_per_mcq_part: number
  upload_points_multiplier: number
  mcq_total_points: number
  upload_total_points: number
  total_points: number
  normalize_mcq_scores: boolean
  require_solution_upload: boolean
  manual_grading_required: boolean
}

export type MultiPartGradingBreakdown = {
  mcq_earned: number
  mcq_max: number
  upload_earned: number | null
  upload_max: number
  upload_pending: boolean
  total_earned: number
  total_max: number
}

export function parseUploadPointsMultiplier(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_UPLOAD_POINTS_MULTIPLIER
  return n
}

export function computeMultiPartPointTotals(
  partCount: number,
  uploadMultiplier: number = DEFAULT_UPLOAD_POINTS_MULTIPLIER,
): { mcq: number; upload: number; total: number } {
  const parts = Math.max(0, partCount)
  const mult = parseUploadPointsMultiplier(uploadMultiplier)
  const mcq = parts
  const upload = parts * mult
  return { mcq, upload, total: mcq + upload }
}

export function deriveMultiPartGradingPolicy(
  subquestionsRaw: unknown,
  configRaw?: unknown,
  courseUploadMultiplier?: number,
): MultiPartGradingPolicy {
  const partCount = getGradableSubquestions(subquestionsRaw).length
  const cfg = parseQuestionSolutionUploadConfig(configRaw)
  const gp = cfg.grading_policy as Record<string, unknown> | undefined

  const multiplier = parseUploadPointsMultiplier(
    gp?.upload_points_multiplier ??
      cfg.upload_points_multiplier ??
      courseUploadMultiplier ??
      DEFAULT_UPLOAD_POINTS_MULTIPLIER,
  )

  const { mcq, upload, total } = computeMultiPartPointTotals(partCount, multiplier)

  return {
    part_count: partCount,
    points_per_mcq_part: 1,
    upload_points_multiplier: multiplier,
    mcq_total_points: mcq,
    upload_total_points: upload,
    total_points: total,
    normalize_mcq_scores: false,
    require_solution_upload:
      gp?.require_solution_upload === true || cfg.require_solution_upload === true,
    manual_grading_required: gp?.manual_grading_required !== false,
  }
}

export function usesStandardMultiPartGradingPolicy(
  configRaw: unknown,
  questionType?: string,
): boolean {
  if ((questionType || "").toLowerCase() === "multi_part") return true
  const cfg = parseQuestionSolutionUploadConfig(configRaw)
  return cfg.grading_policy != null || cfg.require_solution_upload === true
}

/** @deprecated Use deriveMultiPartGradingPolicy with subquestions */
export function parseMultiPartGradingPolicy(
  configRaw: unknown,
  subquestionsRaw?: unknown,
): MultiPartGradingPolicy {
  if (subquestionsRaw != null) {
    return deriveMultiPartGradingPolicy(subquestionsRaw, configRaw)
  }
  const cfg = parseQuestionSolutionUploadConfig(configRaw)
  const gp = cfg.grading_policy as Record<string, unknown> | undefined
  const multiplier = parseUploadPointsMultiplier(gp?.upload_points_multiplier)
  const partCount = Number(gp?.part_count) || 0
  if (partCount > 0) {
    return deriveMultiPartGradingPolicy(
      Array.from({ length: partCount }, (_, i) => ({ id: String(i), type: "mcq", prompt: "", options: [] })),
      configRaw,
    )
  }
  const mcq = Number(gp?.mcq_total_points ?? cfg.selection_max_points) || 0
  const upload = Number(gp?.upload_total_points ?? cfg.solution_max_points) || 0
  return {
    part_count: mcq,
    points_per_mcq_part: 1,
    upload_points_multiplier: multiplier,
    mcq_total_points: mcq,
    upload_total_points: upload,
    total_points: Number(gp?.total_points) || mcq + upload,
    normalize_mcq_scores: gp?.normalize_mcq_scores === true,
    require_solution_upload:
      gp?.require_solution_upload === true || cfg.require_solution_upload === true,
    manual_grading_required: cfg.manual_grading_required !== false,
  }
}

/** Preserve guided step-by-step settings from bank authoring when overlaying standard policy. */
export function mergeBankGuidedSettingsIntoSolutionConfig(
  bankConfigRaw: unknown,
  standard: QuestionSolutionUploadConfig,
): QuestionSolutionUploadConfig {
  const parsed =
    typeof bankConfigRaw === "string"
      ? (() => {
          try {
            return JSON.parse(bankConfigRaw) as Record<string, unknown>
          } catch {
            return null
          }
        })()
      : bankConfigRaw && typeof bankConfigRaw === "object"
        ? (bankConfigRaw as Record<string, unknown>)
        : null
  if (!parsed) return standard

  const gp = parsed.grading_policy as Record<string, unknown> | undefined
  const guidedEnabled =
    parsed.guided_sequential === true || gp?.guided_sequential === true
  if (!guidedEnabled) return standard

  const requireCorrect =
    parsed.guided_require_correct !== false && gp?.guided_require_correct !== false
  const methodSummary =
    typeof parsed.method_summary === "string"
      ? parsed.method_summary.trim()
      : typeof gp?.method_summary === "string"
        ? gp.method_summary.trim()
        : undefined

  return {
    ...standard,
    guided_sequential: true,
    guided_require_correct: requireCorrect,
    method_summary: methodSummary || undefined,
    grading_policy: {
      ...standard.grading_policy,
      guided_sequential: true,
      guided_require_correct: requireCorrect,
      method_summary: methodSummary || undefined,
    },
  }
}

export function buildStandardSolutionUploadConfig(opts?: {
  uploadPointsMultiplier?: number
  partCount?: number
}): QuestionSolutionUploadConfig {
  const multiplier = parseUploadPointsMultiplier(opts?.uploadPointsMultiplier)
  const partCount = Math.max(0, opts?.partCount ?? 0)
  const { mcq, upload, total } = computeMultiPartPointTotals(partCount, multiplier)

  return {
    enabled: true,
    require_solution_upload: false,
    manual_grading_required: true,
    upload_points_multiplier: multiplier,
    selection_max_points: partCount > 0 ? mcq : undefined,
    solution_max_points: partCount > 0 ? upload : undefined,
    grading_policy: {
      part_count: partCount,
      points_per_mcq_part: 1,
      upload_points_multiplier: multiplier,
      mcq_total_points: mcq,
      upload_total_points: upload,
      total_points: total,
      normalize_mcq_scores: false,
      require_solution_upload: false,
      manual_grading_required: true,
    },
    label: STANDARD_SOLUTION_UPLOAD_PROMPT,
  }
}

export function maxPointsForMultiPartQuestion(
  subquestionsRaw: unknown,
  uploadMultiplier?: number,
): number {
  const partCount = getGradableSubquestions(subquestionsRaw).length
  return computeMultiPartPointTotals(partCount, uploadMultiplier).total
}

/** Strip per-part upload flags; each MCQ part counts as 1 pt toward MCQ pool. */
export function normalizeMultiPartSubquestionsForPolicy(raw: unknown): MultiPartSubQuestion[] {
  return getGradableSubquestions(raw).map((sq) => ({
    ...sq,
    points: 1,
    allow_solution_upload: false,
    solution_bonus_percent: undefined,
    solution_upload: undefined,
  }))
}

/** MCQ score on 0–100 scale. */
export function computeNormalizedMcqPercent(
  subquestionsRaw: unknown,
  studentAnswer: unknown,
): { percent: number; correctCount: number; totalCount: number } {
  const subs = getGradableSubquestions(subquestionsRaw)
  if (subs.length === 0) {
    return { percent: 0, correctCount: 0, totalCount: 0 }
  }
  const parsed = parseMultiPartStudentAnswer(studentAnswer, parseSubquestions(subquestionsRaw))
  let fractionSum = 0
  let fullCount = 0
  for (const sq of subs) {
    const { fraction, isFullyCorrect } = gradeSubPart(sq, parsed.parts[sq.id])
    fractionSum += fraction
    if (isFullyCorrect) fullCount++
  }
  const percent = Math.round((fractionSum / subs.length) * 10000) / 100
  return { percent, correctCount: fullCount, totalCount: subs.length }
}

/** 1 point per fully correct MCQ part (partial credit via fraction for select-all). */
export function computeMcqPointsEarned(
  policy: MultiPartGradingPolicy,
  subquestionsRaw: unknown,
  studentAnswer: unknown,
): number {
  const subs = getGradableSubquestions(subquestionsRaw)
  if (subs.length === 0) return 0

  if (policy.normalize_mcq_scores && policy.mcq_total_points > 0) {
    const { percent } = computeNormalizedMcqPercent(subquestionsRaw, studentAnswer)
    return parseFloat(((percent / 100) * policy.mcq_total_points).toFixed(2))
  }

  const perPart = policy.points_per_mcq_part > 0 ? policy.points_per_mcq_part : 1
  const parsed = parseMultiPartStudentAnswer(studentAnswer, parseSubquestions(subquestionsRaw))
  let earned = 0
  for (const sq of subs) {
    const { fraction } = gradeSubPart(sq, parsed.parts[sq.id])
    earned += fraction * perPart
  }
  return parseFloat(Math.min(policy.mcq_total_points, earned).toFixed(2))
}

export function buildMultiPartGradingBreakdown(
  policy: MultiPartGradingPolicy,
  subquestionsRaw: unknown,
  studentAnswer: unknown,
  uploadEarned: number | null,
  uploadPending: boolean,
): MultiPartGradingBreakdown {
  const mcqEarned = computeMcqPointsEarned(policy, subquestionsRaw, studentAnswer)
  const uploadMax = policy.upload_total_points
  const upload =
    uploadEarned != null && Number.isFinite(uploadEarned)
      ? Math.min(uploadMax, Math.max(0, uploadEarned))
      : uploadPending
        ? null
        : 0
  const totalEarned = Math.min(
    policy.total_points,
    parseFloat((mcqEarned + (upload ?? 0)).toFixed(2)),
  )
  return {
    mcq_earned: mcqEarned,
    mcq_max: policy.mcq_total_points,
    upload_earned: upload,
    upload_max: uploadMax,
    upload_pending: uploadPending && upload == null,
    total_earned: totalEarned,
    total_max: policy.total_points,
  }
}

export function parseMultiPartGradingFromAnswerData(
  answerData: unknown,
): MultiPartGradingBreakdown | null {
  if (!answerData || typeof answerData !== "object") return null
  const g = (answerData as Record<string, unknown>).multi_part_grading
  if (!g || typeof g !== "object") return null
  const o = g as Record<string, unknown>
  const mcq = Number(o.mcq_earned)
  const mcqMax = Number(o.mcq_max)
  const uploadMax = Number(o.upload_max)
  const uploadRaw = o.upload_earned
  const upload =
    uploadRaw === null || uploadRaw === undefined
      ? null
      : Number.isFinite(Number(uploadRaw))
        ? Number(uploadRaw)
        : null
  if (!Number.isFinite(mcq) || !Number.isFinite(mcqMax)) return null
  return {
    mcq_earned: mcq,
    mcq_max: mcqMax,
    upload_earned: upload,
    upload_max: Number.isFinite(uploadMax) ? uploadMax : 0,
    upload_pending: o.upload_pending === true,
    total_earned: Number(o.total_earned ?? mcq + (upload ?? 0)),
    total_max: Number(o.total_max ?? mcqMax + (uploadMax || 0)),
  }
}

export function multiPartGradingBreakdownToAnswerData(
  breakdown: MultiPartGradingBreakdown,
): Record<string, unknown> {
  return {
    multi_part_grading: {
      mcq_earned: breakdown.mcq_earned,
      mcq_max: breakdown.mcq_max,
      upload_earned: breakdown.upload_earned,
      upload_max: breakdown.upload_max,
      upload_pending: breakdown.upload_pending,
      total_earned: breakdown.total_earned,
      total_max: breakdown.total_max,
    },
  }
}

/** Rubric buttons as fractions of upload max (100%, 75%, 50%, 25%, 0%). */
export function buildUploadRubricScores(uploadMax: number): number[] {
  if (!(uploadMax > 0)) return [0]
  const fractions = [1, 0.75, 0.5, 0.25, 0]
  return fractions.map((f) => parseFloat((uploadMax * f).toFixed(2)))
}

/** Snap AI-awarded upload points to the nearest instructor rubric tier. */
export function snapUploadPointsToRubric(uploadMax: number, rawPoints: number): number {
  if (!(uploadMax > 0)) return 0
  const clamped = Math.max(0, Math.min(uploadMax, rawPoints))
  const tiers = buildUploadRubricScores(uploadMax)
  let best = tiers[0]
  let bestDist = Math.abs(clamped - best)
  for (const tier of tiers) {
    const dist = Math.abs(clamped - tier)
    if (dist < bestDist) {
      bestDist = dist
      best = tier
    }
  }
  return best
}

/** Derive upload points from percent, aligned to rubric tiers (matches instructor panel). */
export function uploadPointsFromRubricPercent(uploadMax: number, percent: number): number {
  const pct = Math.max(0, Math.min(100, percent))
  const raw = parseFloat(((pct / 100) * uploadMax).toFixed(2))
  return snapUploadPointsToRubric(uploadMax, raw)
}

export function formatMultiPartGradingSummary(
  partCount: number,
  uploadMultiplier: number = DEFAULT_UPLOAD_POINTS_MULTIPLIER,
): string {
  const { mcq, upload, total } = computeMultiPartPointTotals(partCount, uploadMultiplier)
  return `${partCount} MCQ × 1 pt = ${mcq} pt · Upload ×${uploadMultiplier} = ${upload} pt · Total ${total} pt`
}
