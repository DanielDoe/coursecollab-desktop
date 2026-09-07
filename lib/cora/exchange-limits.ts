import type { MembershipTier } from "@/lib/membership-constants"

/** Max user turns per thread for Explorer members. */
export const AI_TUTOR_MAX_EXCHANGES_EXPLORER = 20

/** Max user turns per thread for Trailblazer members. */
export const AI_TUTOR_MAX_EXCHANGES_TRAILBLAZER = 50

/** Messages sent to the API as conversation context (matches server window). */
export const AI_TUTOR_CONTEXT_WINDOW = 10

export function getMaxExchangesForTier(tier: MembershipTier | null | undefined): number {
  if (tier === "Trailblazer") return AI_TUTOR_MAX_EXCHANGES_TRAILBLAZER
  return AI_TUTOR_MAX_EXCHANGES_EXPLORER
}

export function countUserExchanges(
  messages: Array<{ role: string; id?: string }>,
): number {
  return messages.filter(
    (m) => m.role === "student" && m.id !== "welcome" && m.id !== "typing",
  ).length
}

export function isThreadAtExchangeLimit(
  messages: Array<{ role: string; id?: string }>,
  tier: MembershipTier | null | undefined,
): boolean {
  return countUserExchanges(messages) >= getMaxExchangesForTier(tier)
}
