import { sql } from "@/lib/db"
import { clampFlashcardBatchSize, DEFAULT_FLASHCARD_BATCH_SIZE } from "@/lib/flashcard-batch-study"
import { ensureFlashcardSchema } from "@/lib/flashcards"
import {
  clampFlashcardDailyGoal,
  clampFlashcardTimedModeSeconds,
  DEFAULT_FLASHCARD_DAILY_GOAL,
  DEFAULT_FLASHCARD_STUDY_POLICY,
  DEFAULT_FLASHCARD_TIMED_MODE_SECONDS,
  mergeFlashcardStudyPolicy,
  parseFlashcardStudyPolicy,
  type FlashcardStudyPolicy,
} from "@/lib/flashcard-study-policy"

export type FlashcardCourseSettings = {
  requireMcqValidation: boolean
  cardsBeforeQuiz: number
  dailyGoal: number
  timedModeSeconds: number
  studyPolicy: FlashcardStudyPolicy
}

async function ensureFlashcardCourseSettingsSchema(): Promise<void> {
  await ensureFlashcardSchema()
  await sql`
    CREATE TABLE IF NOT EXISTS flashcard_course_settings (
      course_id INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
      require_mcq_validation BOOLEAN NOT NULL DEFAULT true,
      cards_before_quiz INTEGER NOT NULL DEFAULT 10,
      daily_goal INTEGER NOT NULL DEFAULT 10,
      timed_mode_seconds INTEGER NOT NULL DEFAULT 45,
      study_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    ALTER TABLE flashcard_course_settings
    ADD COLUMN IF NOT EXISTS cards_before_quiz INTEGER NOT NULL DEFAULT 10
  `
  await sql`
    ALTER TABLE flashcard_course_settings
    ADD COLUMN IF NOT EXISTS daily_goal INTEGER NOT NULL DEFAULT 10
  `
  await sql`
    ALTER TABLE flashcard_course_settings
    ADD COLUMN IF NOT EXISTS timed_mode_seconds INTEGER NOT NULL DEFAULT 45
  `
  await sql`
    ALTER TABLE flashcard_course_settings
    ADD COLUMN IF NOT EXISTS study_policy JSONB NOT NULL DEFAULT '{}'::jsonb
  `
}

function mapSettingsRow(row: {
  require_mcq_validation: boolean
  cards_before_quiz: number
  daily_goal?: number
  timed_mode_seconds?: number
  study_policy?: unknown
}): FlashcardCourseSettings {
  return {
    requireMcqValidation: Boolean(row.require_mcq_validation),
    cardsBeforeQuiz: clampFlashcardBatchSize(row.cards_before_quiz),
    dailyGoal: clampFlashcardDailyGoal(row.daily_goal),
    timedModeSeconds: clampFlashcardTimedModeSeconds(row.timed_mode_seconds),
    studyPolicy: parseFlashcardStudyPolicy(row.study_policy),
  }
}

export function defaultFlashcardCourseSettings(): FlashcardCourseSettings {
  return {
    requireMcqValidation: true,
    cardsBeforeQuiz: DEFAULT_FLASHCARD_BATCH_SIZE,
    dailyGoal: DEFAULT_FLASHCARD_DAILY_GOAL,
    timedModeSeconds: DEFAULT_FLASHCARD_TIMED_MODE_SECONDS,
    studyPolicy: { ...DEFAULT_FLASHCARD_STUDY_POLICY },
  }
}

export async function fetchFlashcardCourseSettings(
  courseId: number,
): Promise<FlashcardCourseSettings> {
  await ensureFlashcardCourseSettingsSchema()
  const rows = (await sql`
    SELECT require_mcq_validation, cards_before_quiz, daily_goal, timed_mode_seconds, study_policy
    FROM flashcard_course_settings
    WHERE course_id = ${courseId}
    LIMIT 1
  `) as {
    require_mcq_validation: boolean
    cards_before_quiz: number
    daily_goal?: number
    timed_mode_seconds?: number
    study_policy?: unknown
  }[]
  if (!rows.length) return defaultFlashcardCourseSettings()
  return mapSettingsRow(rows[0])
}

export async function upsertFlashcardCourseSettings(
  courseId: number,
  settings: Partial<FlashcardCourseSettings>,
): Promise<FlashcardCourseSettings> {
  await ensureFlashcardCourseSettingsSchema()
  const current = await fetchFlashcardCourseSettings(courseId)
  const requireMcqValidation =
    settings.requireMcqValidation !== undefined
      ? Boolean(settings.requireMcqValidation)
      : current.requireMcqValidation
  const cardsBeforeQuiz =
    settings.cardsBeforeQuiz !== undefined
      ? clampFlashcardBatchSize(settings.cardsBeforeQuiz)
      : current.cardsBeforeQuiz
  const dailyGoal =
    settings.dailyGoal !== undefined ? clampFlashcardDailyGoal(settings.dailyGoal) : current.dailyGoal
  const timedModeSeconds =
    settings.timedModeSeconds !== undefined
      ? clampFlashcardTimedModeSeconds(settings.timedModeSeconds)
      : current.timedModeSeconds
  const studyPolicy =
    settings.studyPolicy !== undefined
      ? mergeFlashcardStudyPolicy(current.studyPolicy, settings.studyPolicy)
      : current.studyPolicy

  await sql`
    INSERT INTO flashcard_course_settings (
      course_id,
      require_mcq_validation,
      cards_before_quiz,
      daily_goal,
      timed_mode_seconds,
      study_policy,
      updated_at
    )
    VALUES (
      ${courseId},
      ${requireMcqValidation},
      ${cardsBeforeQuiz},
      ${dailyGoal},
      ${timedModeSeconds},
      ${JSON.stringify(studyPolicy)}::jsonb,
      NOW()
    )
    ON CONFLICT (course_id) DO UPDATE SET
      require_mcq_validation = EXCLUDED.require_mcq_validation,
      cards_before_quiz = EXCLUDED.cards_before_quiz,
      daily_goal = EXCLUDED.daily_goal,
      timed_mode_seconds = EXCLUDED.timed_mode_seconds,
      study_policy = EXCLUDED.study_policy,
      updated_at = NOW()
  `

  return {
    requireMcqValidation,
    cardsBeforeQuiz,
    dailyGoal,
    timedModeSeconds,
    studyPolicy,
  }
}
