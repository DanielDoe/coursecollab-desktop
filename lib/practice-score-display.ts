/** Normalize score_percentage from DB (may be string, null, or generated). */
export function normalizePracticeScorePercent(value: unknown): number {
  if (value == null || value === "") return 0
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
}
