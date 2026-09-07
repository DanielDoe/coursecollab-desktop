import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export type ContentModuleId = "flashcards" | "course_notes"

export type ModuleTopicAvailabilityRow = {
  topic: string
  session: string
  is_available: boolean
  updated_at: string
}

export async function ensureModuleTopicAvailabilitySchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS module_topic_availability (
      module TEXT NOT NULL,
      topic_name TEXT NOT NULL,
      session VARCHAR(64) NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT true,
      updated_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (module, topic_name, session),
      CONSTRAINT module_topic_availability_module_chk CHECK (module IN ('flashcards', 'course_notes'))
    )
  `
}

export async function listCourseSessionCodes(courseId: number): Promise<string[]> {
  const rows = await sql`
    SELECT code FROM sessions WHERE course_id = ${courseId} ORDER BY code ASC
  `
  return rows.map((r) => String(r.code))
}

export async function upsertModuleTopicAvailability(params: {
  module: ContentModuleId
  topicName: string
  session: string
  isAvailable: boolean
  updatedBy?: number | null
}) {
  const { module, topicName, session, isAvailable, updatedBy = null } = params
  await ensureModuleTopicAvailabilitySchema()
  await sql`
    INSERT INTO module_topic_availability (module, topic_name, session, is_available, updated_by, updated_at)
    VALUES (${module}, ${topicName}, ${session}, ${isAvailable}, ${updatedBy}, NOW())
    ON CONFLICT (module, topic_name, session)
    DO UPDATE SET
      is_available = EXCLUDED.is_available,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `
}

export async function upsertModuleTopicForAllCourseSessions(params: {
  module: ContentModuleId
  courseId: number
  topicName: string
  isAvailable: boolean
  updatedBy?: number | null
}) {
  const codes = await listCourseSessionCodes(params.courseId)
  const sessions = ["ALL", ...codes]
  for (const sess of sessions) {
    await upsertModuleTopicAvailability({
      module: params.module,
      topicName: params.topicName,
      session: sess,
      isAvailable: params.isAvailable,
      updatedBy: params.updatedBy,
    })
  }
}

export async function fetchModuleTopicAvailabilityForSession(
  module: ContentModuleId,
  session: string,
  sessionVariants: string[],
): Promise<ModuleTopicAvailabilityRow[]> {
  await ensureModuleTopicAvailabilitySchema()
  const rows =
    session === "ALL"
      ? await sql`
          SELECT topic_name AS topic, session, is_available, updated_at
          FROM module_topic_availability
          WHERE module = ${module} AND session = 'ALL'
        `
      : await sql`
          SELECT topic_name AS topic, session, is_available, updated_at
          FROM module_topic_availability
          WHERE module = ${module}
            AND TRIM(session) = ANY(${sessionVariants}::text[])
        `

  return rows.map((row) => ({
    topic: String(row.topic),
    session: String(row.session),
    is_available: Boolean(row.is_available),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }))
}

export function resolveModuleTopicAvailability(
  availability: ModuleTopicAvailabilityRow[],
  topicName: string,
  session: string,
): { is_available: boolean; configured: boolean } {
  const row = availability.find((a) => a.topic === topicName)
  if (row) {
    return { is_available: row.is_available, configured: true }
  }
  return { is_available: true, configured: false }
}

export function isModuleTopicVisible(
  availability: ModuleTopicAvailabilityRow[],
  topic: string | null | undefined,
): boolean {
  const name = topic?.trim()
  if (!name) return true
  const row = availability.find((a) => a.topic === name)
  return row ? row.is_available : true
}

export async function fetchDisabledModuleTopicsForStudent(
  module: ContentModuleId,
  session: string | null,
): Promise<Set<string>> {
  const sessionTrim = (session ?? "").trim()
  const sessionVariants =
    sessionTrim.length > 0 ? normalizedSectionVariantsForSql(sessionTrim) : []
  const sessionKey = sessionVariants.length > 0 ? sessionTrim : "ALL"
  const variants = sessionVariants.length > 0 ? sessionVariants : []
  const rows = await fetchModuleTopicAvailabilityForSession(module, sessionKey, variants)
  return new Set(rows.filter((r) => !r.is_available).map((r) => r.topic))
}
