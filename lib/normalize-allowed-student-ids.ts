/**
 * Coerce quiz.allowed_student_ids (jsonb / API) to positive integers for storage and checks.
 * DB drivers or older rows may yield string IDs; Number.isInteger("1") is false and would drop entries.
 */
export function normalizeAllowedStudentIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  const seen = new Set<number>()
  for (const x of raw) {
    const n =
      typeof x === "number" && Number.isFinite(x)
        ? Math.trunc(x)
        : parseInt(String(x).trim(), 10)
    if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}
