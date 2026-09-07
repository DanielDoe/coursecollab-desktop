export const DEFAULT_FLASHCARD_BATCH_SIZE = 10
export const MIN_FLASHCARD_BATCH_SIZE = 2
export const MAX_FLASHCARD_BATCH_SIZE = 50

export type FlashcardBatchStudyPhase =
  | "learn"
  | "water_break_picker"
  | "water_break"
  | "batch_quiz"

export function clampFlashcardBatchSize(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_FLASHCARD_BATCH_SIZE
  return Math.min(MAX_FLASHCARD_BATCH_SIZE, Math.max(MIN_FLASHCARD_BATCH_SIZE, Math.round(n)))
}

export function splitFlashcardBatches<T>(items: T[], batchSize: number): T[][] {
  if (items.length === 0) return []
  const size = clampFlashcardBatchSize(batchSize)
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

export function usesFlashcardBatchQuiz(
  requireMcqValidation: boolean,
  cardCount: number,
): boolean {
  return requireMcqValidation !== false && cardCount >= MIN_FLASHCARD_BATCH_SIZE
}
