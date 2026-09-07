import { parseSubquestions } from "@/lib/multi-part-question"

/**
 * Questions with no per-question countdown — students work at their own pace.
 * Multi-part only; circuit_submission uses {@link CIRCUIT_SUBMISSION_TIME_LIMIT_SECONDS} per question.
 */
export function isUntimedMultiPartQuestion(questionType?: string | null): boolean {
  return (questionType || "").toLowerCase() === "multi_part"
}

/** Sum sub-part weights from bank JSON (before homework scaling). */
export function sumRawSubquestionPoints(raw: unknown): number {
  const subs = parseSubquestions(raw)
  if (subs.length === 0) return 1
  return subs.reduce((s, sq) => s + (sq.points && sq.points > 0 ? sq.points : 1), 0)
}

function hasSolutionUploadRequired(config: unknown): boolean {
  if (!config || typeof config !== "object") return false
  const c = config as { require_solution_upload?: boolean }
  return c.require_solution_upload === true
}

/** Global multiplier applied to all multi-part per-question timers. */
export const MULTI_PART_TIME_LIMIT_MULTIPLIER = 2

/**
 * Time limits for multi-part circuit questions (seconds).
 * Base tiers (before multiplier):
 * 1 pt → 2 min · 2 pt → 4 min · 3 pt → 7 min · 4 pt → 10 min
 * 5 pt → 15 min · 5+ pt with solution upload → 20 min
 */
export function multiPartTimeLimitSeconds(
  rawSubquestionPoints: number,
  options?: { requiresSolutionUpload?: boolean },
): number {
  const hasUpload = options?.requiresSolutionUpload ?? false
  const pts = Math.max(1, Math.round(rawSubquestionPoints))

  let baseSeconds: number
  if (pts <= 1) baseSeconds = 2 * 60
  else if (pts <= 2) baseSeconds = 4 * 60
  else if (pts <= 3) baseSeconds = 7 * 60
  else if (pts <= 4) baseSeconds = 10 * 60
  else if (hasUpload) baseSeconds = 20 * 60
  else baseSeconds = 15 * 60

  return baseSeconds * MULTI_PART_TIME_LIMIT_MULTIPLIER
}

export function resolveMultiPartTimeLimitFromBankRow(row: {
  subquestions?: unknown
  solution_upload_config?: unknown
}): number {
  const rawPts = sumRawSubquestionPoints(row.subquestions)
  let solConfig = row.solution_upload_config
  if (typeof solConfig === "string") {
    try {
      solConfig = JSON.parse(solConfig)
    } catch {
      solConfig = null
    }
  }
  return multiPartTimeLimitSeconds(rawPts, {
    requiresSolutionUpload: hasSolutionUploadRequired(solConfig),
  })
}

export function resolveHomeworkMultiPartTimeLimit(
  bankSubquestions: unknown,
  homeworkRequiresSolutionUpload = true,
): number {
  const rawPts = sumRawSubquestionPoints(bankSubquestions)
  return multiPartTimeLimitSeconds(rawPts, {
    requiresSolutionUpload: homeworkRequiresSolutionUpload,
  })
}
