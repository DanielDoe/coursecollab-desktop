import type { MembershipTier } from "@/lib/membership-constants"
import type { FlashcardCardRow } from "@/lib/flashcards"
import {
  type FlashcardStudyPolicy,
  unlockFractionForTier,
} from "@/lib/flashcard-study-policy"

export function unlockedFlashcardCountForTier(
  tier: MembershipTier,
  total: number,
  policy: FlashcardStudyPolicy,
): number {
  if (total <= 0) return 0
  const fraction = unlockFractionForTier(tier, policy)
  if (fraction <= 0) return 0
  if (fraction >= 1) return total
  return Math.max(1, Math.ceil(total * fraction))
}

/** Cards must already be sorted by sort_order ASC, id ASC. */
export function filterFlashcardCardsForTier<T extends Pick<FlashcardCardRow, "id">>(
  cards: T[],
  tier: MembershipTier,
  policy: FlashcardStudyPolicy,
): T[] {
  const unlockCount = unlockedFlashcardCountForTier(tier, cards.length, policy)
  return cards.slice(0, unlockCount)
}

export function isFlashcardLockedForTier(
  cardId: number,
  sortedCardIds: number[],
  tier: MembershipTier,
  policy: FlashcardStudyPolicy,
): boolean {
  const unlockCount = unlockedFlashcardCountForTier(tier, sortedCardIds.length, policy)
  const unlocked = new Set(sortedCardIds.slice(0, unlockCount))
  return !unlocked.has(cardId)
}
