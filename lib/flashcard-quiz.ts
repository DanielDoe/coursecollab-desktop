import type { FlashcardCard } from "@/lib/flashcards"

export type FlashcardMcqDirection = "front_to_back" | "back_to_front"

export type FlashcardMcqChoice = {
  id: string
  text: string
  isCorrect: boolean
}

export type FlashcardMcq = {
  cardId: number
  direction: FlashcardMcqDirection
  promptLabel: string
  promptText: string
  choices: FlashcardMcqChoice[]
}

const PROMPTS: Record<FlashcardMcqDirection, string> = {
  front_to_back: "Which answer matches this prompt?",
  back_to_front: "Which term or concept matches this definition?",
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickDirection(card: FlashcardCard): FlashcardMcqDirection {
  return card.id % 2 === 0 ? "front_to_back" : "back_to_front"
}

/** Build a multiple-choice question from one card and distractors from the rest of the deck. */
export function buildFlashcardMcq(
  card: FlashcardCard,
  deckCards: FlashcardCard[],
  options?: { direction?: FlashcardMcqDirection; choiceCount?: number },
): FlashcardMcq | null {
  const others = deckCards.filter((c) => c.id !== card.id)
  if (others.length === 0) return null

  const direction = options?.direction ?? pickDirection(card)
  const targetCount = Math.min(Math.max(options?.choiceCount ?? 4, 2), others.length + 1)

  const correctText = direction === "front_to_back" ? card.backText.trim() : card.frontText.trim()
  const promptText = direction === "front_to_back" ? card.frontText.trim() : card.backText.trim()

  if (!correctText || !promptText) return null

  const customPool = (card.customDistractors ?? [])
    .map((t) => t.trim())
    .filter((t) => t && t !== correctText)

  const distractorPool = shuffle([
    ...customPool,
    ...others.map((c) => (direction === "front_to_back" ? c.backText : c.frontText).trim()).filter(Boolean),
  ])
  const uniqueDistractors: string[] = []
  for (const text of distractorPool) {
    if (text === correctText) continue
    if (uniqueDistractors.includes(text)) continue
    uniqueDistractors.push(text)
    if (uniqueDistractors.length >= targetCount - 1) break
  }

  if (uniqueDistractors.length === 0) return null

  const choices = shuffle([
    { id: "correct", text: correctText, isCorrect: true },
    ...uniqueDistractors.map((text, i) => ({
      id: `d${i}`,
      text,
      isCorrect: false,
    })),
  ])

  return {
    cardId: card.id,
    direction,
    promptLabel: PROMPTS[direction],
    promptText,
    choices,
  }
}

export function canUseFlashcardMcq(deckCards: FlashcardCard[]): boolean {
  return deckCards.length >= 2 && deckCards.some((c) => c.frontText.trim() && c.backText.trim())
}

/** Grade a flashcard MCQ tap — correct when the choice was marked at build time. */
export function gradeFlashcardMcqChoice(choice: FlashcardMcqChoice): boolean {
  return choice.isCorrect === true
}

export function flashcardMcqHasSingleCorrectAnswer(mcq: FlashcardMcq): boolean {
  return mcq.choices.filter((choice) => choice.isCorrect).length === 1
}
