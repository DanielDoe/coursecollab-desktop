/** Flashcard gamification — levels, daily goals, study modes. */

export {
  DEFAULT_FLASHCARD_DAILY_GOAL as FLASHCARD_DAILY_GOAL,
  DEFAULT_FLASHCARD_TIMED_MODE_SECONDS as FLASHCARD_TIMED_SECONDS,
} from "@/lib/flashcard-study-policy"
export const FLASHCARD_TIMED_BONUS = 2
export const FLASHCARD_BOSS_BONUS = 3

export type FlashcardStudyMode = "normal" | "timed" | "quiz"

export type FlashcardLevelInfo = {
  level: number
  title: string
  minCards: number
  nextLevelAt: number | null
  progressInLevel: number
  progressToNext: number
}

const LEVELS: { minCards: number; title: string }[] = [
  { minCards: 0, title: "Novice" },
  { minCards: 10, title: "Apprentice" },
  { minCards: 30, title: "Scholar" },
  { minCards: 60, title: "Expert" },
  { minCards: 100, title: "Circuit Master" },
]

export function resolveFlashcardLevel(totalMastered: number): FlashcardLevelInfo {
  const count = Math.max(0, totalMastered)
  let levelIndex = 0
  for (let i = LEVELS.length - 1; i >= 0; i -= 1) {
    if (count >= LEVELS[i].minCards) {
      levelIndex = i
      break
    }
  }
  const current = LEVELS[levelIndex]
  const next = LEVELS[levelIndex + 1] ?? null
  const nextLevelAt = next?.minCards ?? null
  const floor = current.minCards
  const ceiling = nextLevelAt ?? floor + 1
  const span = Math.max(1, ceiling - floor)
  const progressInLevel = next ? count - floor : count - floor
  const progressToNext = next ? Math.min(100, Math.round((progressInLevel / span) * 100)) : 100

  return {
    level: levelIndex + 1,
    title: current.title,
    minCards: floor,
    nextLevelAt,
    progressInLevel,
    progressToNext,
  }
}

export type FlashcardDeckMastery = {
  deckId: number
  mastered: number
  total: number
  pct: number
}

export type FlashcardGamificationProfile = {
  totalMastered: number
  level: FlashcardLevelInfo
  dailyGoal: number
  dailyProgress: number
  dailyGoalMet: boolean
  dailyStreakDays: number
  weeklyMastered: number
}

export type FlashcardLeaderboardEntry = {
  rank: number
  studentId: number
  displayName: string
  cardsMastered: number
  isCurrentUser: boolean
}

/** Compute consecutive-day study streak from sorted ISO date strings (newest first). */
export function computeDailyStreak(sortedDatesNewestFirst: string[]): number {
  if (sortedDatesNewestFirst.length === 0) return 0

  const toDay = (iso: string) => iso.slice(0, 10)
  const today = toDay(new Date().toISOString())
  const yesterday = toDay(new Date(Date.now() - 86400000).toISOString())

  const uniqueDays = [...new Set(sortedDatesNewestFirst.map(toDay))]
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(`${uniqueDays[i - 1]}T12:00:00Z`)
    const curr = new Date(`${uniqueDays[i]}T12:00:00Z`)
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diffDays === 1) streak += 1
    else break
  }
  return streak
}
