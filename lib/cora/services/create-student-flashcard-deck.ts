/**
 * Shared personal flashcard deck create — used by student API, workspace actions, and Cora confirm.
 */

import { sql } from "@/lib/db"
import {
  ensureFlashcardSchema,
  refreshFlashcardDeckCount,
  normalizeFlashcardDifficulty,
  mapFlashcardDeck,
} from "@/lib/flashcards"

export type CreateStudentFlashcardDeckInput = {
  studentDbId: number
  title: string
  description?: string
  topic?: string | null
  cards?: { front: string; back: string; difficulty?: string }[]
}

export type CreateStudentFlashcardDeckResult = {
  deckId: number
  title: string
  cardCount: number
  deck: ReturnType<typeof mapFlashcardDeck>
  href: string
}

export async function createStudentFlashcardDeck(
  input: CreateStudentFlashcardDeckInput,
): Promise<CreateStudentFlashcardDeckResult> {
  await ensureFlashcardSchema()

  const title = String(input.title ?? "").trim() || "Untitled deck"
  const description = String(input.description ?? "")
  const topic =
    input.topic != null && String(input.topic).trim()
      ? String(input.topic).trim().slice(0, 120)
      : null

  const rows = await sql`
    INSERT INTO flashcard_decks (title, description, deck_kind, student_id, topic)
    VALUES (
      ${title.slice(0, 120)},
      ${description.slice(0, 500)},
      'student',
      ${input.studentDbId},
      ${topic}
    )
    RETURNING *
  `
  const row = rows[0]
  if (!row) throw new Error("Could not create flashcard deck.")

  const deckId = Number(row.id)
  const cards = (input.cards ?? [])
    .filter((c) => c.front?.trim() && c.back?.trim())
    .slice(0, 40)

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!
    const difficulty = normalizeFlashcardDifficulty(card.difficulty ?? "medium")
    await sql`
      INSERT INTO flashcard_cards (deck_id, front_text, back_text, sort_order, difficulty)
      VALUES (
        ${deckId},
        ${card.front.trim()},
        ${card.back.trim()},
        ${i},
        ${difficulty}
      )
    `
  }

  if (cards.length > 0) {
    await refreshFlashcardDeckCount(deckId)
  }

  return {
    deckId,
    title: String(row.title),
    cardCount: cards.length,
    deck: mapFlashcardDeck(row as never, true),
    href: `/module/flashcards`,
  }
}
