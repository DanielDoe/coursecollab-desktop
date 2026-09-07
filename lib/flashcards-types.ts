export type FlashcardDeckKind = "course" | "student"

export type FlashcardDifficulty = "easy" | "medium" | "hard" | "very_hard"

export const FLASHCARD_DIFFICULTY_VALUES: FlashcardDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "very_hard",
]

export const FLASHCARD_DIFFICULTY_LABELS: Record<FlashcardDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very hard",
}

export type FlashcardDeck = {
  id: number
  title: string
  description: string
  deckKind: FlashcardDeckKind
  courseId: number | null
  session: string | null
  studentId: number | null
  instructorId: number | null
  topic: string | null
  showInPracticeHub: boolean
  isPublished: boolean
  requireMcqValidation: boolean
  cardsBeforeQuiz: number
  cardCount: number
  createdAt: string
  updatedAt: string
  canEdit: boolean
}

export type FlashcardCard = {
  id: number
  deckId: number
  frontText: string
  backText: string
  sortOrder: number
  difficulty: FlashcardDifficulty
  customDistractors: string[]
  createdAt: string
  updatedAt: string
}

/** Normalize API / question-bank difficulty strings to flashcard_card.difficulty. */
export function normalizeFlashcardDifficulty(raw?: string | null): FlashcardDifficulty {
  const value = String(raw ?? "medium")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if (value === "very_hard" || value === "veryhard" || value === "expert") return "very_hard"
  if (value === "easy") return "easy"
  if (value === "hard") return "hard"
  return "medium"
}
