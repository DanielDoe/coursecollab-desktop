import { ENGAGEMENT_POINTS } from "@/lib/engagement-points-system"
import {
  FLASHCARD_BOSS_BONUS,
  FLASHCARD_TIMED_BONUS,
  type FlashcardLevelInfo,
} from "@/lib/flashcard-gamification"
import { DEFAULT_FLASHCARD_DAILY_GOAL } from "@/lib/flashcard-study-policy"

export type FlashcardAwardTier = "bronze" | "silver" | "gold" | "legendary"

export type FlashcardAwardId =
  | "streak_3"
  | "streak_5"
  | "streak_10"
  | "level_up"
  | "daily_goal"
  | "boss_defeated"
  | "speed_bonus"
  | "deck_cleared"
  | "batch_quiz_cleared"
  | "card_mastered"

export type FlashcardAward = {
  id: FlashcardAwardId
  title: string
  subtitle: string
  tier: FlashcardAwardTier
  xp?: number
  icon: "flame" | "trophy" | "crown" | "zap" | "star" | "medal" | "sparkles"
}

const AWARDS: Record<FlashcardAwardId, Omit<FlashcardAward, "id">> = {
  streak_3: {
    title: "On fire!",
    subtitle: "3 cards in a row — keep the streak alive",
    tier: "bronze",
    xp: ENGAGEMENT_POINTS.flashcardStreakBonusPoints,
    icon: "flame",
  },
  streak_5: {
    title: "Heating up",
    subtitle: "5-card streak — you're in the zone",
    tier: "silver",
    icon: "flame",
  },
  streak_10: {
    title: "Unstoppable",
    subtitle: "10 cards without a miss — legendary focus",
    tier: "gold",
    icon: "flame",
  },
  level_up: {
    title: "Level up!",
    subtitle: "New rank unlocked",
    tier: "gold",
    icon: "medal",
  },
  daily_goal: {
    title: "Daily goal crushed",
    subtitle: `${DEFAULT_FLASHCARD_DAILY_GOAL} cards mastered today`,
    tier: "gold",
    icon: "star",
  },
  boss_defeated: {
    title: "Boss defeated",
    subtitle: `Final card mastered (+${FLASHCARD_BOSS_BONUS} bonus XP)`,
    tier: "legendary",
    xp: FLASHCARD_BOSS_BONUS,
    icon: "crown",
  },
  speed_bonus: {
    title: "Speed demon",
    subtitle: `Answered under time (+${FLASHCARD_TIMED_BONUS} bonus XP)`,
    tier: "silver",
    xp: FLASHCARD_TIMED_BONUS,
    icon: "zap",
  },
  deck_cleared: {
    title: "Deck cleared",
    subtitle: "Every card mastered this round",
    tier: "legendary",
    xp: ENGAGEMENT_POINTS.flashcardSessionCompleteBonus,
    icon: "trophy",
  },
  batch_quiz_cleared: {
    title: "Quiz ace",
    subtitle: "Batch quiz complete — nice recall",
    tier: "silver",
    icon: "sparkles",
  },
  card_mastered: {
    title: "Card mastered",
    subtitle: "First time this week — points synced to Trade Center",
    tier: "bronze",
    xp: ENGAGEMENT_POINTS.flashcardKnownPoints,
    icon: "star",
  },
}

export function buildFlashcardAward(
  id: FlashcardAwardId,
  overrides?: Partial<Pick<FlashcardAward, "title" | "subtitle" | "xp">>,
): FlashcardAward {
  const base = AWARDS[id]
  return { id, ...base, ...overrides }
}

export function streakAwardForCount(streak: number): FlashcardAwardId | null {
  if (streak === 10) return "streak_10"
  if (streak === 5) return "streak_5"
  if (streak === ENGAGEMENT_POINTS.flashcardStreakBonusEvery) return "streak_3"
  return null
}

export function levelUpAward(level: FlashcardLevelInfo): FlashcardAward {
  return buildFlashcardAward("level_up", {
    title: `Level ${level.level}: ${level.title}`,
    subtitle: level.nextLevelAt
      ? `${level.progressInLevel} cards toward the next rank`
      : "Maximum rank achieved",
  })
}

export function shouldCelebrateDailyGoal(
  dailyProgressBefore: number,
  cardsAdded: number,
  dailyGoal: number = DEFAULT_FLASHCARD_DAILY_GOAL,
): boolean {
  const after = dailyProgressBefore + cardsAdded
  return dailyProgressBefore < dailyGoal && after >= dailyGoal
}
