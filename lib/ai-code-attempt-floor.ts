/**
 * Single source for "substantive attempt" minimum score (fraction of question max).
 * Used by evaluateCode prompts, post-process, and submit-time persistence (all assessment types).
 */

import { isLikelyUnmodifiedStarterCode } from "@/lib/code-template-detection"

export const MIN_ATTEMPT_SCORE_FRACTION_BY_MODE: Record<string, number> = {
  relaxed: 0.45,
  standard: 0.3,
  strict: 0.25,
  very_strict: 0.2,
}

/** 0–100 scale, aligned with MIN_ATTEMPT_SCORE_FRACTION_BY_MODE */
export function getMinAttemptScorePercentForPrompt(mode?: string): number {
  const m = String(mode || "standard").toLowerCase()
  const f = MIN_ATTEMPT_SCORE_FRACTION_BY_MODE[m] ?? 0.25
  return Math.round(f * 100)
}

/** System + user prompt text for the active evaluation mode */
export function buildMandatoryAttemptFloorInstructionsForPrompt(mode?: string): string {
  const m = String(mode || "standard").toLowerCase()
  const pct = getMinAttemptScorePercentForPrompt(mode)
  const label =
    m === "relaxed"
      ? "RELAXED"
      : m === "strict"
        ? "STRICT"
        : m === "very_strict"
          ? "VERY STRICT"
          : "STANDARD"
  return `MANDATORY MINIMUM NUMERIC GRADE (${label} mode = "${m}") — REQUIRED IN YOUR JSON

SEPARATE FEEDBACK FROM THE FINAL NUMBER:
- **Feedback:** Evaluate thoroughly. List every problem in "feedback", "gradeBreakdown", "itemizedIssues", and "weaknesses". You may be as detailed and critical as needed—students should see the full picture.
- **Numeric grade — floor only, not generosity:** ${pct}% is a **lower bound** for substantive attempts, **not** a default grade and **not** permission to be forgiving. Students with **many significant errors** should typically finish **at** ${pct}% (the minimum), not in the 60s or 70s. **Do not inflate** scores above the minimum unless the work **objectively** merits it (e.g. partial correct logic, substantial progress toward a solution). When in doubt between "slightly above minimum" and "right at minimum" for weak work, choose **at** the minimum.
- For substantive attempts, **"score"** and **"scoreBreakdown.finalScore"** MUST **NOT finish below ${pct}%** (0–100 scale). If fair deductions would land below ${pct}%, set finalScore to **${pct}%** (not higher).
- If your math would land below ${pct}% after deductions (including suspiciousTypingPenalty when that verdict applies), **raise** finalScore to exactly **${pct}** and state briefly in "gradeBreakdown.reasoning" that the course minimum for substantive attempts applies—do **not** add extra points beyond that unless quality warrants it. **code_write_plot:** never apply suspiciousTypingPenalty (always 0); the floor rule still applies without typing deductions.

WHEN THE MINIMUM DOES NOT APPLY:
- Empty/non-answers, nonsense, or template-only with no real solution: scores may be very low (typically 0–5/100).
- **Default C++ starter only** (iostream boilerplate, int main, placeholder comment, return 0 only—no real solution logic or I/O): **NOT a substantive attempt** — score ~0; **do not** raise to the course floor.

OVERRIDE:
- Any other line in this prompt implying a lower **numeric** cap for substantive work is **wrong** for your JSON output—**${pct}%** is the **floor** for this mode.

CONSISTENCY:
- Set **"score"** === **"scoreBreakdown.finalScore"** (same integer or decimal).`
}

/** Text used to detect substantive attempt (length ≥ 20). */
/**
 * True when the course "substantive attempt" minimum score may apply (length + not template-only code).
 */
export function isEligibleForAttemptMinimumFloor(
  questionType: string | undefined,
  answerTextForAttemptCheck: string,
): boolean {
  const trimmed = (answerTextForAttemptCheck || "").trim()
  if (trimmed.length < 20) return false
  const qt = (questionType || "").toLowerCase()
  const isCodeLike =
    qt.includes("code") ||
    qt === "debug_code" ||
    qt === "code_debug" ||
    qt === "code_explain"
  if (isCodeLike && isLikelyUnmodifiedStarterCode(trimmed)) return false
  return true
}

export function extractTextForAttemptFloorCheck(questionType: string | undefined, answer: unknown): string {
  const qt = (questionType || "").toLowerCase()
  if (answer == null) return ""
  if (typeof answer === "string") {
    if (qt === "code_write_plot") {
      try {
        const p = JSON.parse(answer)
        return String(p?.code ?? answer).trim()
      } catch {
        return answer.trim()
      }
    }
    return answer.trim()
  }
  try {
    return JSON.stringify(answer).trim()
  } catch {
    return String(answer).trim()
  }
}

export function applyAttemptMinimumFloorToPointsEarned(opts: {
  aiEvaluationMode: string | null | undefined
  maxPoints: number
  answerTextForAttemptCheck: string
  pointsEarned: number
  questionType?: string | undefined
}): number {
  const maxPts = Math.max(0.0001, Number(opts.maxPoints) || 1)
  const trimmed = (opts.answerTextForAttemptCheck || "").trim()
  if (!isEligibleForAttemptMinimumFloor(opts.questionType, trimmed)) {
    return parseFloat(Math.min(maxPts, Math.max(0, opts.pointsEarned)).toFixed(2))
  }
  const mode = String(opts.aiEvaluationMode || "standard").toLowerCase()
  const minFraction = MIN_ATTEMPT_SCORE_FRACTION_BY_MODE[mode] ?? 0.25
  const minPts = parseFloat((minFraction * maxPts).toFixed(2))
  let pe = parseFloat(Math.min(maxPts, Math.max(0, opts.pointsEarned)).toFixed(2))
  if (pe < minPts) pe = minPts
  return pe
}

/** Mutates `fb` so score / scoreBreakdown.finalScore match persisted points (call when floor raised points). */
export function syncAiFeedbackObjectToPointsEarned(
  fb: Record<string, unknown>,
  maxPoints: number,
  pointsEarned: number
): void {
  const maxPts = Math.max(0.0001, Number(maxPoints) || 1)
  const pe = parseFloat(Math.min(maxPts, Math.max(0, pointsEarned)).toFixed(2))
  const pct = Math.round((pe / maxPts) * 100)
  fb.score = pct
  fb.pointsEarned = pe
  const sbRaw = fb.scoreBreakdown
  const base = typeof sbRaw === "object" && sbRaw !== null ? { ...(sbRaw as Record<string, unknown>) } : {}
  fb.scoreBreakdown = { ...base, finalScore: pct }
}
