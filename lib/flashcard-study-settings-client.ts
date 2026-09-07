import type { FlashcardDeckKind } from "@/lib/flashcards"
import type { FlashcardTierAccessClient } from "@/lib/flashcard-study-policy"
import { unlockedFlashcardCountForTier } from "@/lib/flashcard-tier-access"
import type { MembershipTier } from "@/lib/membership-constants"
import type { FlashcardStudyPolicy } from "@/lib/flashcard-study-policy"

export type FlashcardStudySettingsClient = {
  dailyGoal: number
  timedModeSeconds: number
  tierAccess: FlashcardTierAccessClient
  totalCards?: number
  unlockedCards?: number
}

export function computeUnlockedCardCountForDeck(
  totalCards: number,
  deckKind: FlashcardDeckKind,
  tierAccess: FlashcardTierAccessClient | null | undefined,
): number {
  if (totalCards <= 0) return 0
  if (deckKind !== "course" || !tierAccess) return totalCards
  if (!tierAccess.canStudyCourseDeck) return 0
  if (tierAccess.unlockFraction >= 1) return totalCards
  return Math.max(1, Math.ceil(totalCards * tierAccess.unlockFraction))
}

export function lockedCardCountForDeck(
  totalCards: number,
  unlockedCards: number,
): number {
  return Math.max(0, totalCards - unlockedCards)
}

/** Re-export for deck-detail responses that include card totals. */
export function unlockedCountFromPolicy(
  total: number,
  tier: MembershipTier,
  policy: FlashcardStudyPolicy,
): number {
  return unlockedFlashcardCountForTier(tier, total, policy)
}
