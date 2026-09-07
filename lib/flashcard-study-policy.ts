/**
 * Course-level flashcard study rules (daily goal, timed mode, membership tier caps).
 */

import type { MembershipTier } from "@/lib/membership-constants"

export type FlashcardStudyPolicy = {
  /** Scholar: fraction of each course deck unlocked (0 = no course cards). */
  scholar_unlock_fraction: number
  /** Explorer: fraction of each course deck unlocked (default 0.5). */
  explorer_unlock_fraction: number
  /** Daily mastered-card cap per tier (-1 = unlimited). Course decks only. */
  scholar_daily_card_cap: number
  explorer_daily_card_cap: number
  trailblazer_daily_card_cap: number
}

export const DEFAULT_FLASHCARD_STUDY_POLICY: FlashcardStudyPolicy = {
  scholar_unlock_fraction: 0,
  explorer_unlock_fraction: 0.5,
  scholar_daily_card_cap: 10,
  explorer_daily_card_cap: -1,
  trailblazer_daily_card_cap: -1,
}

export const DEFAULT_FLASHCARD_DAILY_GOAL = 10
export const DEFAULT_FLASHCARD_TIMED_MODE_SECONDS = 45

export const MIN_FLASHCARD_DAILY_GOAL = 1
export const MAX_FLASHCARD_DAILY_GOAL = 100
export const MIN_FLASHCARD_TIMED_MODE_SECONDS = 10
export const MAX_FLASHCARD_TIMED_MODE_SECONDS = 300

function clampFraction(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}

function clampDailyCap(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < 0) return -1
  return Math.min(500, Math.max(0, Math.round(n)))
}

export function clampFlashcardDailyGoal(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_FLASHCARD_DAILY_GOAL
  return Math.min(MAX_FLASHCARD_DAILY_GOAL, Math.max(MIN_FLASHCARD_DAILY_GOAL, Math.round(n)))
}

export function clampFlashcardTimedModeSeconds(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_FLASHCARD_TIMED_MODE_SECONDS
  return Math.min(
    MAX_FLASHCARD_TIMED_MODE_SECONDS,
    Math.max(MIN_FLASHCARD_TIMED_MODE_SECONDS, Math.round(n)),
  )
}

export function parseFlashcardStudyPolicy(raw: unknown): FlashcardStudyPolicy {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    scholar_unlock_fraction: clampFraction(
      obj.scholar_unlock_fraction,
      DEFAULT_FLASHCARD_STUDY_POLICY.scholar_unlock_fraction,
    ),
    explorer_unlock_fraction: clampFraction(
      obj.explorer_unlock_fraction,
      DEFAULT_FLASHCARD_STUDY_POLICY.explorer_unlock_fraction,
    ),
    scholar_daily_card_cap: clampDailyCap(
      obj.scholar_daily_card_cap,
      DEFAULT_FLASHCARD_STUDY_POLICY.scholar_daily_card_cap,
    ),
    explorer_daily_card_cap: clampDailyCap(
      obj.explorer_daily_card_cap,
      DEFAULT_FLASHCARD_STUDY_POLICY.explorer_daily_card_cap,
    ),
    trailblazer_daily_card_cap: clampDailyCap(
      obj.trailblazer_daily_card_cap,
      DEFAULT_FLASHCARD_STUDY_POLICY.trailblazer_daily_card_cap,
    ),
  }
}

export function mergeFlashcardStudyPolicy(
  current: FlashcardStudyPolicy,
  patch: Partial<FlashcardStudyPolicy>,
): FlashcardStudyPolicy {
  return parseFlashcardStudyPolicy({ ...current, ...patch })
}

export function unlockFractionForTier(
  tier: MembershipTier,
  policy: FlashcardStudyPolicy,
): number {
  if (tier === "Trailblazer") return 1
  if (tier === "Explorer") return clampFraction(policy.explorer_unlock_fraction, 0.5)
  return clampFraction(policy.scholar_unlock_fraction, 0)
}

export function dailyCardCapForTier(
  tier: MembershipTier,
  policy: FlashcardStudyPolicy,
): number {
  if (tier === "Trailblazer") return policy.trailblazer_daily_card_cap
  if (tier === "Explorer") return policy.explorer_daily_card_cap
  return policy.scholar_daily_card_cap
}

export type FlashcardTierAccessClient = {
  unlockFraction: number
  dailyCardCap: number
  upgradeRequiredTier: MembershipTier | null
  canStudyCourseDeck: boolean
}

export function flashcardAccessForStudentClient(
  tier: MembershipTier,
  policy: FlashcardStudyPolicy,
): FlashcardTierAccessClient {
  const unlockFraction = unlockFractionForTier(tier, policy)
  const dailyCardCap = dailyCardCapForTier(tier, policy)
  return {
    unlockFraction,
    dailyCardCap,
    canStudyCourseDeck: unlockFraction > 0,
    upgradeRequiredTier:
      unlockFraction <= 0 ? "Explorer" : tier === "Explorer" && unlockFraction < 1 ? "Trailblazer" : null,
  }
}
