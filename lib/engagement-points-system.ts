/**
 * Unified engagement activity points + EC conversion.
 *
 * Weekly activity points (Trade Center) → trade for Engagement Credits (gradebook).
 * 100 activity points = 1 EC by default (configurable via ec_conversion_multiplier).
 */

export const ENGAGEMENT_POINTS = {
  /** Default: 0.01 → 100 points = 1 EC */
  defaultEcMultiplier: 0.01,
  defaultMaxTradedEc: 10,
  defaultMinTradePoints: 100,

  weeklyPracticeCap: 60,
  weeklyPlaygroundCap: 36,
  weeklyReadingCap: 40,

  /** Practice Hub: 8 pts per attempt + score/20 bonus */
  practiceHubBasePerAttempt: 8,
  practiceHubScoreDivisor: 20,

  /** Lecture sample practice (first attempt per question): 8 correct, 4 incorrect */
  samplePracticeCorrectPoints: 8,
  samplePracticeWrongPoints: 4,
  samplePracticeWeeklyCap: 32,

  /** Playground: 12 pts per session + up to 18 bonus from score */
  playgroundBasePerSession: 12,
  playgroundScoreDivisor: 15,
  playgroundScoreBonusMax: 18,

  /** Lecture slides/PDF pages: 1 pt per unique slide opened */
  readingPointsPerSlide: 1,

  /** Flashcards: first “know it” per card per week + session bonus */
  flashcardKnownPoints: 4,
  flashcardSessionCompleteBonus: 12,
  flashcardStreakBonusEvery: 3,
  flashcardStreakBonusPoints: 2,
  flashcardWeeklyCap: 48,

  /** Gradebook auto-EC caps (lifetime, before trading) */
  gradebookPracticeMax: 50,
  gradebookPlaygroundMax: 30,
  gradebookReadingMax: 20,
  gradebookTotalMax: 100,
} as const

/** Normalize gradebook engagement credits for UI (0–100, one decimal). */
export function clampGradebookEngagementCredits(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return (
    Math.round(
      Math.min(ENGAGEMENT_POINTS.gradebookTotalMax, Math.max(0, n)) * 10,
    ) / 10
  )
}

export type TradeCenterPointCaps = {
  weekly_practice_cap: number
  weekly_playground_cap: number
  weekly_reading_cap: number
  practice_weight: number
  playground_weight: number
  reading_weight: number
  ec_conversion_multiplier?: number
  max_engagement_credits?: number
  min_donation_points?: number
}

export function getDefaultTradeCenterCaps(): TradeCenterPointCaps {
  return {
    weekly_practice_cap: ENGAGEMENT_POINTS.weeklyPracticeCap,
    weekly_playground_cap: ENGAGEMENT_POINTS.weeklyPlaygroundCap,
    weekly_reading_cap: ENGAGEMENT_POINTS.weeklyReadingCap,
    practice_weight: 1,
    playground_weight: 1,
    reading_weight: 1,
    ec_conversion_multiplier: ENGAGEMENT_POINTS.defaultEcMultiplier,
    max_engagement_credits: ENGAGEMENT_POINTS.defaultMaxTradedEc,
    min_donation_points: ENGAGEMENT_POINTS.defaultMinTradePoints,
  }
}

/** Points required for 1 EC from multiplier (EC = points × multiplier). */
export function getPointsPerEc(multiplier?: number | null): number {
  const m =
    multiplier != null && Number.isFinite(Number(multiplier)) && Number(multiplier) > 0
      ? Number(multiplier)
      : ENGAGEMENT_POINTS.defaultEcMultiplier
  return Math.max(1, Math.round(1 / m))
}

export function calculateEcFromPoints(
  totalPoints: number,
  options?: { multiplier?: number | null; maxEc?: number; currentEc?: number },
): number {
  const pointsPerEc = getPointsPerEc(options?.multiplier)
  if (totalPoints < pointsPerEc) return 0
  const maxEc = options?.maxEc ?? ENGAGEMENT_POINTS.defaultMaxTradedEc
  const currentEc = options?.currentEc ?? 0
  const headroom = Math.max(0, maxEc - currentEc)
  if (headroom <= 0) return 0
  return Math.min(Math.floor(totalPoints / pointsPerEc), headroom)
}

export function calculateEcFromTradeAmount(
  pointsToTrade: number,
  options?: { multiplier?: number | null; maxEc?: number; currentEc?: number },
): number {
  return calculateEcFromPoints(pointsToTrade, options)
}

export function applyWeightedWeeklyCap(rawPoints: number, cap: number, weight = 1): number {
  const weightedCap = Math.floor(cap * (weight > 0 ? weight : 1))
  return Math.min(Math.max(0, Math.floor(rawPoints)), Math.max(0, weightedCap))
}

export function calculatePracticeHubPoints(
  attemptCount: number,
  avgScorePercent: number,
  opts?: { basePerAttempt?: number; scoreDivisor?: number },
): number {
  const attempts = Math.max(0, attemptCount)
  const avg = Math.max(0, avgScorePercent)
  const base = opts?.basePerAttempt ?? ENGAGEMENT_POINTS.practiceHubBasePerAttempt
  const divisor = opts?.scoreDivisor ?? ENGAGEMENT_POINTS.practiceHubScoreDivisor
  return attempts * base + Math.floor(avg / divisor)
}

export function calculateSamplePracticePoints(correctCount: number, wrongCount: number): number {
  const correct = Math.max(0, correctCount)
  const wrong = Math.max(0, wrongCount)
  const raw =
    correct * ENGAGEMENT_POINTS.samplePracticeCorrectPoints +
    wrong * ENGAGEMENT_POINTS.samplePracticeWrongPoints
  return Math.min(raw, ENGAGEMENT_POINTS.samplePracticeWeeklyCap)
}

export function calculateFlashcardWeeklyPoints(
  knownFirstTimeCount: number,
  sessionCompleteCount: number,
): number {
  const known = Math.max(0, knownFirstTimeCount)
  const sessions = Math.max(0, sessionCompleteCount)
  const raw =
    known * ENGAGEMENT_POINTS.flashcardKnownPoints +
    sessions * ENGAGEMENT_POINTS.flashcardSessionCompleteBonus
  return Math.min(raw, ENGAGEMENT_POINTS.flashcardWeeklyCap)
}

export function calculateCombinedPracticeWeeklyPoints(
  hubAttemptCount: number,
  hubAvgScore: number,
  sampleCorrect: number,
  sampleWrong: number,
  caps: Pick<TradeCenterPointCaps, "weekly_practice_cap" | "practice_weight">,
  flashcardKnownFirstTime = 0,
  flashcardSessionsComplete = 0,
  hubEngagement?: { basePerAttempt?: number; scoreDivisor?: number },
): number {
  const hub = calculatePracticeHubPoints(hubAttemptCount, hubAvgScore, hubEngagement)
  const sample = calculateSamplePracticePoints(sampleCorrect, sampleWrong)
  const flashcards = calculateFlashcardWeeklyPoints(flashcardKnownFirstTime, flashcardSessionsComplete)
  const raw = hub + sample + flashcards
  return applyWeightedWeeklyCap(raw, caps.weekly_practice_cap, caps.practice_weight)
}

export function calculatePlaygroundWeeklyPointsFromSessions(
  sessionCount: number,
  avgScorePerSession: number,
  caps: Pick<TradeCenterPointCaps, "weekly_playground_cap" | "playground_weight">,
): number {
  const sessions = Math.max(0, sessionCount)
  const avg = Math.max(0, avgScorePerSession)
  const perSession =
    ENGAGEMENT_POINTS.playgroundBasePerSession +
    Math.min(Math.floor(avg / ENGAGEMENT_POINTS.playgroundScoreDivisor), ENGAGEMENT_POINTS.playgroundScoreBonusMax)
  const raw = sessions * perSession
  return applyWeightedWeeklyCap(raw, caps.weekly_playground_cap, caps.playground_weight)
}

export function calculateReadingWeeklyPoints(
  slidesOpened: number,
  caps: Pick<TradeCenterPointCaps, "weekly_reading_cap" | "reading_weight">,
): number {
  const raw = Math.max(0, slidesOpened) * ENGAGEMENT_POINTS.readingPointsPerSlide
  return applyWeightedWeeklyCap(raw, caps.weekly_reading_cap, caps.reading_weight)
}

/** Lifetime gradebook practice credits (Practice Hub + sample practice). */
export function calculateGradebookPracticeCredits(attemptCount: number, avgScorePercent: number): number {
  const participation = Math.min(attemptCount * 0.5, 10)
  const performance = (Math.max(0, avgScorePercent) / 100) * 40
  return Math.min(participation + performance, ENGAGEMENT_POINTS.gradebookPracticeMax)
}

export function calculateGradebookPlaygroundCredits(sessionCount: number, totalScore: number): number {
  const participation = Math.min(sessionCount * 0.3, 6)
  const performance = Math.min(Math.max(0, totalScore) / 10, 24)
  return Math.min(participation + performance, ENGAGEMENT_POINTS.gradebookPlaygroundMax)
}

export function calculateGradebookReadingCredits(lectureRatioSum: number): number {
  return Math.min(Math.max(0, lectureRatioSum), ENGAGEMENT_POINTS.gradebookReadingMax)
}

export function splitTradeDeduction(
  pointsToTrade: number,
  practicePoints: number,
  playgroundPoints: number,
  readingPoints: number,
): { practice: number; playground: number; reading: number } {
  const total = practicePoints + playgroundPoints + readingPoints
  if (pointsToTrade <= 0 || total <= 0) {
    return { practice: 0, playground: 0, reading: 0 }
  }
  const trade = Math.min(pointsToTrade, total)
  const practiceRatio = practicePoints / total
  const playgroundRatio = playgroundPoints / total
  const practice = Math.min(practicePoints, Math.floor(trade * practiceRatio))
  const playground = Math.min(playgroundPoints, Math.floor(trade * playgroundRatio))
  const reading = Math.min(readingPoints, trade - practice - playground)
  return { practice, playground, reading }
}

export function formatPointsPerEcLabel(multiplier?: number | null): string {
  return `${getPointsPerEc(multiplier)} activity points = 1 EC`
}
