export type QuizQuestionScoring = {
  id: string
  correctIndex?: number
  correctIndices?: number[]
  multiSelect?: boolean
}

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function isQuizAnswerCorrect(
  question: QuizQuestionScoring,
  selected: unknown,
): boolean {
  if (selected == null) return false
  if (question.multiSelect && question.correctIndices) {
    return Array.isArray(selected) && arraysEqual(selected as number[], question.correctIndices)
  }
  if (typeof selected === "number" && question.correctIndex != null) {
    return selected === question.correctIndex
  }
  return false
}

export function scoreQuizAnswers(
  questions: QuizQuestionScoring[],
  answers: Record<string, unknown> | undefined,
): { correct: number; total: number } {
  const safe = answers ?? {}
  const total = questions.length
  if (total === 0) return { correct: 0, total: 0 }
  let correct = 0
  for (const q of questions) {
    if (isQuizAnswerCorrect(q, safe[q.id])) correct += 1
  }
  return { correct, total }
}

/** XP for a knowledge check — scales with correct answers, capped per block. */
export function xpForQuizScore(correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 0
  const perCorrect = 8
  const maxPerBlock = 40
  return Math.min(maxPerBlock, correct * perCorrect)
}
