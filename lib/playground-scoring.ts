import type { PlaygroundScoringConfig } from "@/lib/playground-policy-settings"

/** Speed-based points for one correct playground answer (configurable min–max). */
export function computePlaygroundAnswerPoints(
  isCorrect: boolean,
  responseTimeMs: number | null | undefined,
  config?: Partial<PlaygroundScoringConfig>,
): number {
  if (!isCorrect) return 0
  const pointsMax = config?.pointsMax ?? 5
  const pointsMin = config?.pointsMin ?? 3
  const speedWindowMs = config?.speedWindowMs ?? 10000
  const actualResponseTime = Number(responseTimeMs) || 0
  const timeRatio = Math.min(actualResponseTime / speedWindowMs, 1)
  return Math.round(pointsMax - timeRatio * (pointsMax - pointsMin))
}

/** SQL expression fragment for summing points from playground_answers rows. */
export const PLAYGROUND_ANSWER_POINTS_SQL = `
  CASE
    WHEN is_correct THEN
      ROUND(5 - (LEAST(COALESCE(response_time_ms, 0), 10000) / 10000.0 * 2))
    ELSE 0
  END
`
