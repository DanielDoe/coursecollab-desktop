import { sql } from "@/lib/db"
import { ENGAGEMENT_POINTS } from "@/lib/engagement-points-system"
import {
  FLASHCARD_BOSS_BONUS,
  FLASHCARD_TIMED_BONUS,
} from "@/lib/flashcard-gamification"
import { syncActivityPointsAfterAction } from "@/lib/trade-center-sync"
import {
  DEFAULT_TRADE_CENTER_CONFIG,
  getWeekEndExclusiveDateString,
  getWeekStartDateString,
  parseTradeCenterConfigRow,
} from "@/lib/trade-center-shared"
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema"
import { resolveTradeSessionForStudent } from "@/lib/trade-center-student-access"

export type FlashcardStudyOutcome = "known" | "learning" | "session_complete"

export type RecordFlashcardStudyInput = {
  studentDbId: number
  sessionCode: string
  deckId: number
  cardId?: number
  outcome: FlashcardStudyOutcome
  sessionId: string
  streak?: number
  bonusType?: "timed" | "boss"
}

export type FlashcardStudyRecordResult = {
  recorded: boolean
  pointsEarned: number
  streakBonus: number
  firstKnownThisWeek: boolean
  firstKnownThisSession: boolean
  sessionCompleteBonus: boolean
  pointsSynced: boolean
}

let flashcardStudySchemaPromise: Promise<void> | null = null

export async function ensureFlashcardStudySchema(): Promise<void> {
  if (!flashcardStudySchemaPromise) {
    flashcardStudySchemaPromise = applyFlashcardStudySchema().catch((error) => {
      flashcardStudySchemaPromise = null
      throw error
    })
  }
  await flashcardStudySchemaPromise
}

async function applyFlashcardStudySchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS flashcard_study_events (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
      card_id INTEGER REFERENCES flashcard_cards(id) ON DELETE CASCADE,
      session_id VARCHAR(64) NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('known', 'learning', 'session_complete')),
      points_awarded INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_flashcard_study_events_student_time
      ON flashcard_study_events (student_id, completed_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_flashcard_study_events_session
      ON flashcard_study_events (student_id, session_id, completed_at DESC)
  `
}

async function resolveWeekBounds(sessionCode: string, studentDbId: number) {
  let weeklyResetDay = DEFAULT_TRADE_CENTER_CONFIG.weekly_reset_day
  try {
    await ensureTradeCenterConfigSchema()
    const normalizedSession = await resolveTradeSessionForStudent(sessionCode, studentDbId)
    const config = await sql`
      SELECT weekly_reset_day FROM trade_center_config
      WHERE (session = ${normalizedSession} OR session = 'ALL') AND is_active = true
      ORDER BY CASE WHEN session = ${normalizedSession} THEN 0 ELSE 1 END
      LIMIT 1
    `
    if (config.length > 0) {
      weeklyResetDay = parseTradeCenterConfigRow(config[0] as Record<string, unknown>).weekly_reset_day
    }
  } catch {
    /* defaults */
  }
  const weekStartDate = getWeekStartDateString(new Date(), weeklyResetDay)
  const weekEndExclusive = getWeekEndExclusiveDateString(weekStartDate)
  return { weekStartDate, weekEndExclusive }
}

export async function fetchFlashcardDeckProgress(
  studentDbId: number,
  deckId: number,
): Promise<{ masteredCardIds: number[]; weeklyPoints: number }> {
  await ensureFlashcardStudySchema()
  const mastered = await sql`
    SELECT DISTINCT card_id
    FROM flashcard_study_events
    WHERE student_id = ${studentDbId}
      AND deck_id = ${deckId}
      AND outcome = 'known'
      AND card_id IS NOT NULL
  `
  const points = await sql`
    SELECT COALESCE(SUM(points_awarded), 0)::int AS total
    FROM flashcard_study_events
    WHERE student_id = ${studentDbId}
      AND deck_id = ${deckId}
      AND completed_at >= date_trunc('week', NOW())
  `
  return {
    masteredCardIds: (mastered as { card_id: number }[])
      .map((r) => Number(r.card_id))
      .filter((id) => Number.isFinite(id)),
    weeklyPoints: Number((points[0] as { total?: number })?.total) || 0,
  }
}

/** Record a flashcard study action and award engagement points when eligible. */
export async function recordFlashcardStudyEvent(
  input: RecordFlashcardStudyInput,
): Promise<FlashcardStudyRecordResult> {
  const { studentDbId, sessionCode, deckId, cardId, outcome, sessionId, streak = 0, bonusType } = input

  await ensureFlashcardStudySchema()

  let pointsEarned = 0
  let streakBonus = 0
  let firstKnownThisWeek = false
  let firstKnownThisSession = false
  let sessionCompleteBonus = false

  if (outcome === "known" && cardId != null) {
    const { weekStartDate, weekEndExclusive } = await resolveWeekBounds(sessionCode, studentDbId)
    const [priorWeek, priorSession] = await Promise.all([
      sql`
        SELECT id FROM flashcard_study_events
        WHERE student_id = ${studentDbId}
          AND card_id = ${cardId}
          AND outcome = 'known'
          AND completed_at >= ${weekStartDate}::date
          AND completed_at < ${weekEndExclusive}::date
        LIMIT 1
      `,
      sql`
        SELECT id FROM flashcard_study_events
        WHERE student_id = ${studentDbId}
          AND card_id = ${cardId}
          AND session_id = ${sessionId}
          AND outcome = 'known'
        LIMIT 1
      `,
    ])
    firstKnownThisWeek = priorWeek.length === 0
    firstKnownThisSession = priorSession.length === 0
    if (firstKnownThisSession) {
      pointsEarned += ENGAGEMENT_POINTS.flashcardKnownPoints
    }
    if (
      streak > 0 &&
      streak % ENGAGEMENT_POINTS.flashcardStreakBonusEvery === 0 &&
      firstKnownThisSession
    ) {
      streakBonus = ENGAGEMENT_POINTS.flashcardStreakBonusPoints
      pointsEarned += streakBonus
    }
    if (bonusType === "timed") {
      pointsEarned += FLASHCARD_TIMED_BONUS
    }
    if (bonusType === "boss") {
      pointsEarned += FLASHCARD_BOSS_BONUS
    }
  }

  if (outcome === "session_complete") {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const priorSession = await sql`
      SELECT id FROM flashcard_study_events
      WHERE student_id = ${studentDbId}
        AND deck_id = ${deckId}
        AND outcome = 'session_complete'
        AND completed_at >= ${todayStart.toISOString()}::timestamptz
      LIMIT 1
    `
    sessionCompleteBonus = priorSession.length === 0
    if (sessionCompleteBonus) {
      pointsEarned += ENGAGEMENT_POINTS.flashcardSessionCompleteBonus
    }
  }

  const rows = await sql`
    INSERT INTO flashcard_study_events (
      student_id, deck_id, card_id, session_id, outcome, points_awarded
    )
    VALUES (
      ${studentDbId},
      ${deckId},
      ${cardId ?? null},
      ${sessionId},
      ${outcome},
      ${pointsEarned}
    )
    RETURNING id
  `

  let pointsSynced = false
  if (pointsEarned > 0 && rows.length > 0) {
    try {
      await syncActivityPointsAfterAction(studentDbId, sessionCode)
      pointsSynced = true
    } catch {
      pointsSynced = false
    }
  }

  return {
    recorded: rows.length > 0,
    pointsEarned,
    streakBonus,
    firstKnownThisWeek,
    firstKnownThisSession,
    sessionCompleteBonus,
    pointsSynced,
  }
}

/** Weekly flashcard stats for trade-center practice sync. */
export async function fetchWeeklyFlashcardEngagementStats(
  studentDbId: number,
  weekStartDate: string,
  weekEndExclusive: string,
): Promise<{ knownFirstTime: number; sessionsComplete: number }> {
  await ensureFlashcardStudySchema()

  const knownRows = await sql`
    SELECT COUNT(DISTINCT card_id)::int AS c
    FROM flashcard_study_events
    WHERE student_id = ${studentDbId}
      AND outcome = 'known'
      AND card_id IS NOT NULL
      AND points_awarded > 0
      AND completed_at >= ${weekStartDate}::date
      AND completed_at < ${weekEndExclusive}::date
  `

  const sessionRows = await sql`
    SELECT COUNT(*)::int AS c
    FROM flashcard_study_events
    WHERE student_id = ${studentDbId}
      AND outcome = 'session_complete'
      AND points_awarded > 0
      AND completed_at >= ${weekStartDate}::date
      AND completed_at < ${weekEndExclusive}::date
  `

  return {
    knownFirstTime: Number(knownRows[0]?.c) || 0,
    sessionsComplete: Number(sessionRows[0]?.c) || 0,
  }
}
