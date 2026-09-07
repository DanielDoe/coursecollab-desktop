import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

function isMissingRelation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /relation .* does not exist/i.test(message)
}

export async function ensurePracticeTopicAvailabilityTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS topic_availability (
      id SERIAL PRIMARY KEY,
      topic TEXT NOT NULL,
      session TEXT NOT NULL,
      is_available BOOLEAN DEFAULT true,
      daily_limit INTEGER DEFAULT 10,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS practice_topic_availability (
      id SERIAL PRIMARY KEY,
      topic_name TEXT NOT NULL,
      session TEXT NOT NULL,
      is_available BOOLEAN DEFAULT true,
      daily_limit INTEGER DEFAULT 10,
      updated_by INTEGER,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS topic_availability_topic_session_uidx
      ON topic_availability (topic, session)
    `
  } catch (error) {
    console.error("topic_availability unique index:", error)
  }
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS practice_topic_availability_topic_session_uidx
      ON practice_topic_availability (topic_name, session)
    `
  } catch (error) {
    console.error("practice_topic_availability unique index:", error)
  }
}

export async function listCourseSessionCodes(courseId: number): Promise<string[]> {
  const rows = await sql`
    SELECT code FROM sessions WHERE course_id = ${courseId} ORDER BY code ASC
  `
  return rows
    .map((row) => String(row.code ?? "").trim())
    .filter((code) => code.length > 0 && code.toUpperCase() !== "BETA")
}

async function writePracticeTopicAvailabilityRow(params: {
  topicName: string
  session: string
  isAvailable: boolean
  dailyLimit: number
  updatedBy: number | null
}) {
  const { topicName, session, isAvailable, dailyLimit, updatedBy } = params
  const existing = await sql`
    SELECT id FROM practice_topic_availability
    WHERE topic_name = ${topicName} AND session = ${session}
    LIMIT 1
  `
  if (existing.length > 0) {
    await sql`
      UPDATE practice_topic_availability
      SET
        is_available = ${isAvailable},
        daily_limit = ${dailyLimit},
        updated_by = ${updatedBy},
        updated_at = NOW()
      WHERE topic_name = ${topicName} AND session = ${session}
    `
    return
  }
  await sql`
    INSERT INTO practice_topic_availability (topic_name, session, is_available, daily_limit, updated_by, updated_at)
    VALUES (${topicName}, ${session}, ${isAvailable}, ${dailyLimit}, ${updatedBy}, NOW())
  `
}

async function writeLegacyTopicAvailabilityRow(params: {
  topicName: string
  session: string
  isAvailable: boolean
  dailyLimit: number
}) {
  const { topicName, session, isAvailable, dailyLimit } = params
  const existing = await sql`
    SELECT id FROM topic_availability
    WHERE topic = ${topicName} AND session = ${session}
    LIMIT 1
  `
  if (existing.length > 0) {
    await sql`
      UPDATE topic_availability
      SET
        is_available = ${isAvailable},
        daily_limit = ${dailyLimit},
        updated_at = NOW()
      WHERE topic = ${topicName} AND session = ${session}
    `
    return
  }
  await sql`
    INSERT INTO topic_availability (topic, session, is_available, daily_limit, updated_at)
    VALUES (${topicName}, ${session}, ${isAvailable}, ${dailyLimit}, NOW())
  `
}

export async function upsertPracticeTopicAvailability(params: {
  topicName: string
  session: string
  isAvailable: boolean
  dailyLimit?: number
  updatedBy?: number | null
}) {
  const { topicName, session, isAvailable, dailyLimit = 10, updatedBy = null } = params
  await ensurePracticeTopicAvailabilityTables()

  let wrote = false
  let lastError: unknown = null
  try {
    await writePracticeTopicAvailabilityRow({
      topicName,
      session,
      isAvailable,
      dailyLimit,
      updatedBy,
    })
    wrote = true
  } catch (error) {
    lastError = error
    if (!isMissingRelation(error)) {
      console.error("practice_topic_availability upsert failed:", error)
    }
  }

  try {
    await writeLegacyTopicAvailabilityRow({
      topicName,
      session,
      isAvailable,
      dailyLimit,
    })
    wrote = true
  } catch (error) {
    lastError = error
    if (!isMissingRelation(error)) {
      console.error("topic_availability upsert failed:", error)
    }
  }

  if (!wrote && lastError) {
    throw lastError instanceof Error ? lastError : new Error("Failed to persist topic availability")
  }
}

export async function upsertPracticeTopicForAllCourseSessions(params: {
  courseId: number
  topicName: string
  isAvailable: boolean
  dailyLimit?: number
  updatedBy?: number | null
}) {
  const dailyLimit = params.dailyLimit ?? 10
  await upsertPracticeTopicAvailability({
    topicName: params.topicName,
    session: "ALL",
    isAvailable: params.isAvailable,
    dailyLimit,
    updatedBy: params.updatedBy,
  })
  try {
    await sql`
      UPDATE practice_topic_availability
      SET
        is_available = ${params.isAvailable},
        daily_limit = ${dailyLimit},
        updated_by = ${params.updatedBy ?? null},
        updated_at = NOW()
      WHERE topic_name = ${params.topicName}
    `
  } catch (error) {
    if (!isMissingRelation(error)) {
      console.error("bulk practice_topic_availability update failed:", error)
    }
  }
  try {
    await sql`
      UPDATE topic_availability
      SET
        is_available = ${params.isAvailable},
        daily_limit = ${dailyLimit},
        updated_at = NOW()
      WHERE topic = ${params.topicName}
    `
  } catch (error) {
    if (!isMissingRelation(error)) {
      console.error("bulk topic_availability update failed:", error)
    }
  }
}

export async function disablePracticeTopicForSession(params: {
  topicName: string
  session: string
  dailyLimit?: number
  updatedBy?: number | null
}) {
  await upsertPracticeTopicAvailability({
    topicName: params.topicName,
    session: params.session,
    isAvailable: false,
    dailyLimit: params.dailyLimit ?? 10,
    updatedBy: params.updatedBy,
  })
}

export async function disablePracticeTopicForAllCourseSessions(params: {
  courseId: number
  topicName: string
  updatedBy?: number | null
}) {
  const codes = await listCourseSessionCodes(params.courseId)
  const sessions = ["ALL", ...codes]
  for (const sess of sessions) {
    await disablePracticeTopicForSession({
      topicName: params.topicName,
      session: sess,
      updatedBy: params.updatedBy,
    })
  }
}

export type PracticeTopicAvailabilityRow = {
  topic: string
  session: string
  is_available: boolean
  daily_limit: number
  updated_at: string
}

/** Prefer practice_topic_availability; fall back to legacy topic_availability. */
export async function fetchPracticeTopicAvailabilityForSession(
  session: string,
  sessionVariants: string[],
): Promise<PracticeTopicAvailabilityRow[]> {
  let practiceRows: Array<Record<string, unknown>> = []
  try {
    practiceRows =
      session === "ALL"
        ? await sql`
            SELECT
              topic_name AS topic,
              session,
              is_available,
              daily_limit,
              updated_at
            FROM practice_topic_availability
            WHERE session = 'ALL'
          `
        : await sql`
            SELECT
              topic_name AS topic,
              session,
              is_available,
              daily_limit,
              updated_at
            FROM practice_topic_availability
            WHERE TRIM(session) = ANY(${sessionVariants}::text[])
          `
  } catch (error) {
    if (!isMissingRelation(error)) throw error
  }

  if (practiceRows.length > 0) {
    return practiceRows.map((row) => ({
      topic: String(row.topic),
      session: String(row.session),
      is_available: Boolean(row.is_available),
      daily_limit: Number(row.daily_limit ?? 10),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    }))
  }

  const legacyRows =
    session === "ALL"
      ? await sql`
          SELECT topic, session, is_available, daily_limit, updated_at
          FROM topic_availability
          WHERE session = 'ALL'
        `
      : await sql`
          SELECT topic, session, is_available, daily_limit, updated_at
          FROM topic_availability
          WHERE TRIM(session) = ANY(${sessionVariants}::text[])
        `

  return legacyRows.map((row) => ({
    topic: String(row.topic),
    session: String(row.session),
    is_available: Boolean(row.is_available),
    daily_limit: Number(row.daily_limit ?? 10),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }))
}
