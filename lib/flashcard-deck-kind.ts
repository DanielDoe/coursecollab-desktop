/**
 * Flashcard deck list visuals — parity with course-collab-mobile/expo/src/lib/flashcard-deck-kind.ts
 */

import { flashcardListStatusColor } from "@/lib/flashcard-list-theme"
import type { FlashcardDeck } from "@/lib/flashcards-types"

export type FlashcardDeckCardKind = "empty" | "completed" | "in_progress" | "available"

export function clampMasteryPct(value?: number | null): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function resolveFlashcardDeckKind(
  deck: Pick<FlashcardDeck, "cardCount">,
  masteryPct?: number | null,
): FlashcardDeckCardKind {
  if (deck.cardCount <= 0) return "empty"
  const pct = clampMasteryPct(masteryPct)
  if (pct >= 100) return "completed"
  if (pct > 0) return "in_progress"
  return "available"
}

export function flashcardDeckStatusLabel(kind: FlashcardDeckCardKind, studyLocked?: boolean): string {
  if (studyLocked) return "Upgrade to unlock"
  switch (kind) {
    case "empty":
      return "Empty deck"
    case "completed":
      return "Mastered"
    case "in_progress":
      return "In progress"
    default:
      return "Ready to study"
  }
}

export function flashcardDeckStatusAccent(
  kind: FlashcardDeckCardKind,
  thumbFill: string,
  studyLocked?: boolean,
  roles?: Parameters<typeof flashcardListStatusColor>[3],
): string {
  return flashcardListStatusColor(kind, thumbFill, studyLocked, roles)
}

export function flashcardDeckTopicLabel(deck: Pick<FlashcardDeck, "topic" | "deckKind">): string {
  const topic = deck.topic?.trim()
  if (topic) return topic
  return deck.deckKind === "course" ? "Course deck" : "My deck"
}

export function flashcardDeckMetaLine(
  deck: Pick<FlashcardDeck, "cardCount">,
  masteryPct?: number | null,
): string {
  const count = `${deck.cardCount} card${deck.cardCount === 1 ? "" : "s"}`
  const pct = clampMasteryPct(masteryPct)
  if (deck.cardCount <= 0) return "Add cards to start studying"
  if (pct > 0) return `${count} · ${pct}% mastered`
  return count
}
