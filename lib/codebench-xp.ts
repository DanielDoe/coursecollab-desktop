/**
 * CodeBench XP System
 * Handles XP awarding and tracking for CodeBench activities
 */

const XP_REWARDS = {
  EXPLAIN: 5,
  DEBUG: 5,
  IMPROVE: 5,
  PSEUDOCODE: 5,
  TUTOR_QUESTION: 3,
  CODE_SUBMIT: 10,
  DAILY_CHALLENGE: 10, // Base, can vary
  BADGE_UNLOCK: 15,
  STREAK_3_DAYS: 20,
  STREAK_7_DAYS: 50,
  STREAK_14_DAYS: 100,
  STREAK_30_DAYS: 200,
} as const

/**
 * Award XP for a CodeBench action
 */
export function awardXP(action: keyof typeof XP_REWARDS, amount?: number): number {
  if (typeof window === "undefined") return 0

  const xpAmount = amount || XP_REWARDS[action]
  const currentXp = parseInt(localStorage.getItem("codebench_xp") || "0", 10)
  const newXp = currentXp + xpAmount

  localStorage.setItem("codebench_xp", newXp.toString())

  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent("codebench-xp-updated", { detail: { xp: newXp, earned: xpAmount } }))

  return xpAmount
}

/**
 * Get current XP
 */
export function getCurrentXP(): number {
  if (typeof window === "undefined") return 0
  return parseInt(localStorage.getItem("codebench_xp") || "0", 10)
}

/**
 * Check and award streak bonuses
 */
export function checkStreakBonus(streakDays: number): number {
  if (streakDays === 3) return awardXP("STREAK_3_DAYS")
  if (streakDays === 7) return awardXP("STREAK_7_DAYS")
  if (streakDays === 14) return awardXP("STREAK_14_DAYS")
  if (streakDays === 30) return awardXP("STREAK_30_DAYS")
  return 0
}

/**
 * Award XP for badge unlock
 */
export function awardBadgeXP(): number {
  return awardXP("BADGE_UNLOCK")
}

export { XP_REWARDS }


