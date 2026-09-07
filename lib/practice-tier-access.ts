import type { MembershipTier } from "@/lib/membership-constants"
import type { PracticeHubPolicy } from "@/lib/practice-hub-policy-settings"

export type PracticeAccessLevel = "none" | "partial" | "full"

export function practiceAccessLevelForTier(tier: MembershipTier): PracticeAccessLevel {
  if (tier === "Trailblazer") return "full"
  if (tier === "Explorer") return "partial"
  return "none"
}

export function explorerUnlockFraction(policy: PracticeHubPolicy): number {
  const raw = Number(policy.explorer_unlock_fraction)
  if (!Number.isFinite(raw) || raw <= 0 || raw >= 1) return 0.5
  return raw
}

export function unlockedQuestionCountForTier(
  tier: MembershipTier,
  total: number,
  policy?: PracticeHubPolicy,
): number {
  if (total <= 0) return 0
  const level = practiceAccessLevelForTier(tier)
  if (level === "full") return total
  if (level === "none") return 0
  const fraction = policy ? explorerUnlockFraction(policy) : 0.5
  return Math.max(1, Math.ceil(total * fraction))
}

export function sortedQuestionIds(questions: Array<{ id: unknown }>): number[] {
  return [...questions]
    .map((q) => Number(q.id))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
}

export function unlockedQuestionIdSet(
  tier: MembershipTier,
  questionIdsSorted: number[],
  policy?: PracticeHubPolicy,
): Set<number> {
  const unlockCount = unlockedQuestionCountForTier(tier, questionIdsSorted.length, policy)
  return new Set(questionIdsSorted.slice(0, unlockCount))
}

export function isPracticeQuestionLocked(
  tier: MembershipTier,
  questionId: number,
  questionIdsSorted: number[],
  policy?: PracticeHubPolicy,
): boolean {
  if (practiceAccessLevelForTier(tier) === "full") return false
  if (practiceAccessLevelForTier(tier) === "none") return true
  return !unlockedQuestionIdSet(tier, questionIdsSorted, policy).has(questionId)
}

export function applyPracticeQuestionLocks<T extends { id: unknown }>(
  questions: T[],
  tier: MembershipTier,
  policy?: PracticeHubPolicy,
): Array<T & { locked: boolean }> {
  const ids = sortedQuestionIds(questions)
  const unlocked = unlockedQuestionIdSet(tier, ids, policy)
  const byId = new Map<number, T & { locked: boolean }>()
  for (const q of questions) {
    const id = Number(q.id)
    byId.set(id, { ...q, locked: !unlocked.has(id) })
  }
  return ids.map((id) => byId.get(id)).filter((q): q is T & { locked: boolean } => !!q)
}

export function practiceAccessForStudentClient(
  tier: MembershipTier,
  policy: PracticeHubPolicy,
) {
  const level = practiceAccessLevelForTier(tier)
  return {
    level,
    canOpenTopics: level !== "none",
    canStartPractice: level !== "none",
    unlockFraction: level === "partial" ? explorerUnlockFraction(policy) : level === "full" ? 1 : 0,
    upgradeRequiredTier: level === "none" ? "Explorer" : level === "partial" ? "Trailblazer" : null,
  }
}
