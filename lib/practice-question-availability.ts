import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export async function ensurePracticeQuestionAvailabilityTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS practice_question_availability (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
      session VARCHAR(64) NOT NULL DEFAULT 'ALL',
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (question_id, session)
    )
  `
}

export async function upsertPracticeQuestionAvailability(params: {
  questionId: number
  session: string
  isAvailable: boolean
  updatedBy?: number | null
}) {
  const { questionId, session, isAvailable, updatedBy = null } = params
  await ensurePracticeQuestionAvailabilityTable()
  await sql`
    INSERT INTO practice_question_availability (question_id, session, is_available, updated_by, updated_at)
    VALUES (${questionId}, ${session}, ${isAvailable}, ${updatedBy}, NOW())
    ON CONFLICT (question_id, session)
    DO UPDATE SET
      is_available = EXCLUDED.is_available,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `
}

export async function bulkUpsertPracticeQuestionAvailability(params: {
  questionIds: number[]
  session: string
  isAvailable: boolean
  updatedBy?: number | null
}) {
  const { questionIds, session, isAvailable, updatedBy = null } = params
  if (questionIds.length === 0) return
  await ensurePracticeQuestionAvailabilityTable()
  for (const questionId of questionIds) {
    await upsertPracticeQuestionAvailability({ questionId, session, isAvailable, updatedBy })
  }
}

/** Question is hidden when an explicit is_available=false row matches ALL or the student session. */
export async function isPracticeQuestionHidden(
  questionId: number,
  practiceSession: string,
  sessionVariants: string[],
): Promise<boolean> {
  await ensurePracticeQuestionAvailabilityTable()
  const variants = sessionVariants.length > 0 ? sessionVariants : [practiceSession]
  const rows = await sql`
    SELECT 1
    FROM practice_question_availability pqa
    WHERE pqa.question_id = ${questionId}
      AND pqa.is_available = false
      AND (
        TRIM(pqa.session::text) = 'ALL'
        OR TRIM(pqa.session::text) = TRIM(${practiceSession}::text)
        OR TRIM(pqa.session::text) = ANY(${variants}::text[])
      )
    LIMIT 1
  `
  return rows.length > 0
}

export async function resolvePracticeQuestionAvailability(
  questionIds: number[],
  session: string,
): Promise<Map<number, boolean>> {
  if (questionIds.length === 0) return new Map()
  await ensurePracticeQuestionAvailabilityTable()

  const sessionVariants =
    session !== "ALL" ? normalizedSectionVariantsForSql(session) : []

  let rows: Array<{ question_id: unknown; session: unknown; is_available: unknown }>
  if (session === "ALL") {
    rows = await sql`
      SELECT question_id, session, is_available
      FROM practice_question_availability
      WHERE question_id = ANY(${questionIds})
        AND TRIM(session::text) = 'ALL'
    `
  } else if (sessionVariants.length > 0) {
    rows = await sql`
      SELECT question_id, session, is_available
      FROM practice_question_availability
      WHERE question_id = ANY(${questionIds})
        AND (
          TRIM(session::text) = 'ALL'
          OR TRIM(session::text) = TRIM(${session}::text)
          OR TRIM(session::text) = ANY(${sessionVariants}::text[])
        )
    `
  } else {
    rows = await sql`
      SELECT question_id, session, is_available
      FROM practice_question_availability
      WHERE question_id = ANY(${questionIds})
        AND (
          TRIM(session::text) = 'ALL'
          OR TRIM(session::text) = TRIM(${session}::text)
        )
    `
  }

  const byQuestion = new Map<number, { all?: boolean; scoped?: boolean }>()
  for (const row of rows) {
    const id = Number(row.question_id)
    const entry = byQuestion.get(id) ?? {}
    if (String(row.session).trim() === "ALL") {
      entry.all = Boolean(row.is_available)
    } else {
      entry.scoped = Boolean(row.is_available)
    }
    byQuestion.set(id, entry)
  }

  const result = new Map<number, boolean>()
  for (const id of questionIds) {
    const entry = byQuestion.get(id)
    if (!entry) {
      result.set(id, true)
      continue
    }
    if (session !== "ALL" && entry.scoped != null) {
      result.set(id, entry.scoped)
    } else if (entry.all != null) {
      result.set(id, entry.all)
    } else {
      result.set(id, entry.scoped ?? true)
    }
  }
  return result
}
