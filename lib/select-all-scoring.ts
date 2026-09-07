/**
 * Partial credit for "Select All That Apply" (select_all) questions.
 *
 * C = correct options selected (count)
 * I = incorrect options selected (count)
 * T = total number of correct answers (must be > 0)
 *
 * Raw = (C − I) / T, clamped to [0, 1]
 */

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * @param correctNormalized — unique normalized strings for each correct option (caller dedupes)
 * @param submittedNormalized — normalized strings for each student selection (duplicates ignored via Set)
 */
export function computeSelectAllScoreFraction(
  correctNormalized: string[],
  submittedNormalized: string[]
): { fraction: number; c: number; i: number; t: number } {
  const correctSet = new Set(correctNormalized.map(norm).filter(Boolean))
  const t = correctSet.size
  if (t === 0) {
    return { fraction: 0, c: 0, i: 0, t: 0 }
  }

  const submittedSet = new Set(submittedNormalized.map(norm).filter(Boolean))

  let c = 0
  let i = 0
  for (const s of submittedSet) {
    if (correctSet.has(s)) c++
    else i++
  }

  let raw = (c - i) / t
  if (raw < 0) raw = 0
  if (raw > 1) raw = 1

  return { fraction: raw, c, i, t }
}

export function isSelectAllFullyCorrect(fraction: number): boolean {
  return fraction >= 1 - 1e-9
}
