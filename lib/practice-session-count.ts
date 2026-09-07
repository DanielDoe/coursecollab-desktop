/**
 * Tier-aware practice session sizing — mirrors mobile `practice-session-count.ts`.
 */

export type PracticeTopicPool = {
  questionCount: number
  completed: number
  unlockedCount?: number | null
}

export type PracticeAccessClient = {
  level?: "none" | "partial" | "full" | string
  canStartPractice?: boolean
  unlockFraction?: number | null
  upgradeRequiredTier?: string | null
}

export function practiceTopicUnlockedCount(topic: PracticeTopicPool): number {
  return topic.unlockedCount ?? topic.questionCount
}

export function isPracticeTopicLocked(
  topic: PracticeTopicPool,
  canStartPractice: boolean,
): boolean {
  if (!canStartPractice) return true
  return practiceTopicUnlockedCount(topic) <= 0
}

/** Scholar: 0. Explorer: unlocked pool. Trailblazer: full bank (via unlockedCount === questionCount). */
export function resolvePracticeSessionQuestionCount(
  topic: PracticeTopicPool,
  configNumQuestions?: number | null,
): number {
  const unlockedPool = practiceTopicUnlockedCount(topic)
  const practiced = topic.completed
  const remaining = Math.max(0, unlockedPool - practiced)
  const pool = remaining > 0 ? remaining : unlockedPool
  const configured = Number(configNumQuestions)
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.min(configured, Math.max(1, pool)))
  }
  return Math.max(1, pool)
}

export function practiceTopicProgressLabel(topic: PracticeTopicPool & { lockedCount?: number | null }): string {
  const unlocked = practiceTopicUnlockedCount(topic)
  const locked =
    topic.lockedCount ?? Math.max(0, topic.questionCount - unlocked)
  if (unlocked <= 0) {
    return `${topic.questionCount} questions · locked`
  }
  if (locked > 0) {
    return `${topic.completed}/${unlocked} practiced · ${locked} locked`
  }
  return `${topic.completed}/${topic.questionCount} practiced`
}
