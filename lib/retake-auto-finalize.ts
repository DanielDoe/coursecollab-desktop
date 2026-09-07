/**
 * Maps quizzes.retake_policy (and optional JSON) to auto-finalize behavior when
 * no attempt is explicitly flagged is_final_grade (e.g. cron / instructor bulk).
 *
 * DB values: 'best' | 'latest' | 'average' (see create-quiz-form).
 * Legacy JSON: { "gradingMethod": "highest" | ... }
 */

export type AutoFinalizeGrading = "highest" | "latest" | "first" | "fastest" | "average"

export function normalizeQuizRetakePolicyForAutoFinalize(
  raw: string | null | undefined
): AutoFinalizeGrading {
  if (raw == null) return "highest"
  const s = String(raw).trim()
  if (!s) return "highest"

  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s) as { gradingMethod?: string }
      if (typeof o.gradingMethod === "string") {
        return mapGradingMethodString(o.gradingMethod)
      }
    } catch {
      // fall through — column may be plain 'best' etc.
    }
  }

  if (s === "best") return "highest"
  if (s === "latest") return "latest"
  if (s === "average") return "average"
  return mapGradingMethodString(s)
}

function mapGradingMethodString(g: string): AutoFinalizeGrading {
  const x = g.toLowerCase()
  if (x === "highest" || x === "best") return "highest"
  if (x === "latest") return "latest"
  if (x === "first") return "first"
  if (x === "fastest") return "fastest"
  if (x === "average") return "average"
  return "highest"
}

export type CompletedAttemptRow = {
  id: number
  score: unknown
  completed_at?: unknown
  time_taken_seconds?: number | null
  /** Distinct questions with a submitted answer (used for highest-vs-latest fallback). */
  submitted_question_count?: number
}

/**
 * When retake policy is "highest", prefer the latest completed attempt if it has
 * strictly more submitted answers than the highest-scoring attempt (e.g. retake
 * finished all sections while the older high score is missing Section I/II work).
 */
export function pickSingleFinalAttemptId(
  completedAttempts: CompletedAttemptRow[],
  grading: Exclude<AutoFinalizeGrading, "average">,
): number | null {
  if (completedAttempts.length === 0) return null

  switch (grading) {
    case "highest": {
      const best = completedAttempts.reduce((top, cur) => {
        const cs = parseFloat(String(cur.score ?? 0)) || 0
        const bs = parseFloat(String(top.score ?? 0)) || 0
        if (cs > bs) return cur
        if (cs < bs) return top
        const cAt = cur.completed_at ? new Date(cur.completed_at as string).getTime() : 0
        const bAt = top.completed_at ? new Date(top.completed_at as string).getTime() : 0
        return cAt >= bAt ? cur : top
      })

      const latest = completedAttempts[0]
      const bestSubmitted = best.submitted_question_count ?? 0
      const latestSubmitted = latest.submitted_question_count ?? 0

      if (
        latest.id !== best.id &&
        latestSubmitted > bestSubmitted
      ) {
        return latest.id
      }

      return best.id
    }

    case "latest":
      return completedAttempts[0].id

    case "first":
      return completedAttempts[completedAttempts.length - 1].id

    case "fastest":
      return completedAttempts.reduce((fastest, cur) => {
        const ft = fastest.time_taken_seconds ?? Infinity
        const ct = cur.time_taken_seconds ?? Infinity
        return ct < ft ? cur : fastest
      }).id

    default:
      return completedAttempts[0].id
  }
}
