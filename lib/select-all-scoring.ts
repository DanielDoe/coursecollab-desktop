/**
 * Select-all / multi_output scoring.
 *
 * N = number of unique correct options.
 * Award 1/N of max points for each correctly selected option.
 * Deduct 1/N for each incorrectly selected option.
 * Clamp to [0, maxPoints].
 * Full credit only when the selected set exactly matches the correct set.
 */

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map(norm).filter(Boolean))]
}

export function selectAllAnswersMatch(correct: string[], selected: string[]): boolean {
  const correctSet = new Set(uniqueNormalized(correct))
  const selectedSet = new Set(uniqueNormalized(selected))
  if (correctSet.size === 0) return false
  if (correctSet.size !== selectedSet.size) return false
  for (const value of selectedSet) {
    if (!correctSet.has(value)) return false
  }
  return true
}

/**
 * @param correctNormalized — unique normalized strings for each correct option (caller may pass raw)
 * @param submittedNormalized — student selections (duplicates ignored)
 */
export function computeSelectAllScoreFraction(
  correctNormalized: string[],
  submittedNormalized: string[],
): { fraction: number; c: number; i: number; t: number } {
  const correctSet = new Set(uniqueNormalized(correctNormalized))
  const t = correctSet.size
  if (t === 0) {
    return { fraction: 0, c: 0, i: 0, t: 0 }
  }

  const submittedSet = new Set(uniqueNormalized(submittedNormalized))

  let c = 0
  let i = 0
  for (const s of submittedSet) {
    if (correctSet.has(s)) c++
    else i++
  }

  const raw = (c - i) / t
  const fraction = Math.max(0, Math.min(1, raw))

  return { fraction, c, i, t }
}

export function isSelectAllFullyCorrect(
  correctOrFraction: string[] | number,
  submitted?: string[],
): boolean {
  if (typeof correctOrFraction === "number") {
    return correctOrFraction >= 1 - 1e-9
  }
  return selectAllAnswersMatch(correctOrFraction, submitted ?? [])
}

export type SelectAllScore = {
  points: number
  fraction: number
  isFullyCorrect: boolean
  correctSelected: number
  incorrectSelected: number
  correctCount: number
}

/** Score a select-all question in points. Full credit only on exact set match. */
export function scoreSelectAllQuestion(
  selected: string[],
  correct: string[],
  maxPoints: number,
): SelectAllScore {
  const { fraction, c, i, t } = computeSelectAllScoreFraction(correct, selected)
  const cap = Number.isFinite(maxPoints) ? Math.max(0, maxPoints) : 0
  const rawPoints = cap * (c - i) / (t || 1)
  const points =
    t === 0 ? 0 : parseFloat(Math.max(0, Math.min(cap, rawPoints)).toFixed(2))
  return {
    points,
    fraction,
    isFullyCorrect: selectAllAnswersMatch(correct, selected),
    correctSelected: c,
    incorrectSelected: i,
    correctCount: t,
  }
}
