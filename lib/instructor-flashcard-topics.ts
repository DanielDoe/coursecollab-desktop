import { sql } from "@/lib/db"
import {
  fetchModuleTopicAvailabilityForSession,
  listCourseSessionCodes,
  resolveModuleTopicAvailability,
} from "@/lib/module-topic-availability"
import type { ModuleContentSessionFilter } from "@/lib/module-content-session-scope"
import { moduleContentSessionFilterLabel } from "@/lib/module-content-session-scope"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { ensureFlashcardSchema } from "@/lib/flashcards"
import { fetchFlashcardCourseSettings } from "@/lib/flashcard-course-settings"

export type FlashcardSectionAvailability = {
  is_available: boolean
  configured: boolean
}

export type FlashcardConfigSection = {
  id: number
  code: string
  studentCount: number
}

function dedupeConfigSections(
  rows: { id?: number; code: string; student_count?: number }[],
): FlashcardConfigSection[] {
  const map = new Map<string, FlashcardConfigSection>()
  for (const row of rows) {
    const code = String(row.code).trim()
    if (!code) continue
    const count = Number(row.student_count) || 0
    const existing = map.get(code)
    if (existing) {
      existing.studentCount += count
    } else {
      map.set(code, {
        id: Number(row.id) || 0,
        code,
        studentCount: count,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
}

export type FlashcardConfigTopic = {
  name: string
  deck_count: number
  card_count: number
  /** Keyed by section code, including "ALL" for course-wide default. */
  availability: Record<string, FlashcardSectionAvailability>
}

export type FlashcardConfiguration = {
  sections: FlashcardConfigSection[]
  topics: FlashcardConfigTopic[]
  requireMcqValidation: boolean
  cardsBeforeQuiz: number
}

export async function fetchFlashcardConfiguration(courseId: number): Promise<FlashcardConfiguration> {
  await ensureFlashcardSchema()

  const sessionRows = await sql`
    SELECT s.id, s.code, COUNT(st.id)::int AS student_count
    FROM sessions s
    LEFT JOIN students st ON st.session_id = s.id
    WHERE s.course_id = ${courseId}
    GROUP BY s.id, s.code
    ORDER BY s.code ASC
  `

  const sections = dedupeConfigSections(sessionRows as { id: number; code: string; student_count: number }[])

  const sectionKeys = ["ALL", ...sections.map((s) => s.code)]

  const availabilityBySection = new Map<string, Awaited<ReturnType<typeof fetchModuleTopicAvailabilityForSession>>>()
  for (const code of sectionKeys) {
    const variants = code !== "ALL" ? normalizedSectionVariantsForSql(code) : []
    availabilityBySection.set(
      code,
      await fetchModuleTopicAvailabilityForSession("flashcards", code, variants),
    )
  }

  const topicRows = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(topic), ''), 'General') AS name,
      COUNT(*)::int AS deck_count,
      COALESCE(SUM(card_count), 0)::int AS card_count
    FROM flashcard_decks
    WHERE deck_kind = 'course'
      AND course_id = ${courseId}
      AND deleted_at IS NULL
    GROUP BY COALESCE(NULLIF(TRIM(topic), ''), 'General')
    ORDER BY name
  `

  const topics: FlashcardConfigTopic[] = topicRows.map((row) => {
    const name = String(row.name)
    const availability: Record<string, FlashcardSectionAvailability> = {}
    for (const code of sectionKeys) {
      availability[code] = resolveModuleTopicAvailability(
        availabilityBySection.get(code) ?? [],
        name,
        code,
      )
    }
    return {
      name,
      deck_count: Number(row.deck_count) || 0,
      card_count: Number(row.card_count) || 0,
      availability,
    }
  })

  const courseSettings = await fetchFlashcardCourseSettings(courseId)

  return {
    sections,
    topics,
    requireMcqValidation: courseSettings.requireMcqValidation,
    cardsBeforeQuiz: courseSettings.cardsBeforeQuiz,
    dailyGoal: courseSettings.dailyGoal,
    timedModeSeconds: courseSettings.timedModeSeconds,
    studyPolicy: courseSettings.studyPolicy,
  }
}

/** Topics list with availability for one section filter (browse views). */
export async function fetchFlashcardTopicsForCourse(params: {
  courseId: number
  sessionFilter?: ModuleContentSessionFilter
  /** @deprecated Use sessionFilter */
  session?: string
}): Promise<
  {
    name: string
    deck_count: number
    card_count: number
    availability: Record<string, FlashcardSectionAvailability>
  }[]
> {
  const sessionFilter =
    params.sessionFilter ??
    (params.session?.trim() && params.session !== "ALL"
      ? {
          mode: "section" as const,
          sessionCode: params.session.trim(),
          sessionVariants: normalizedSectionVariantsForSql(params.session.trim()),
        }
      : { mode: "all" as const })
  const session = moduleContentSessionFilterLabel(sessionFilter)
  const sessionVariants =
    sessionFilter.mode === "section" ? sessionFilter.sessionVariants : []

  await ensureFlashcardSchema()

  const rows =
    sessionFilter.mode === "section"
      ? await sql`
          SELECT
            COALESCE(NULLIF(TRIM(topic), ''), 'General') AS name,
            COUNT(*)::int AS deck_count,
            COALESCE(SUM(card_count), 0)::int AS card_count
          FROM flashcard_decks
          WHERE deck_kind = 'course'
            AND course_id = ${params.courseId}
            AND deleted_at IS NULL
            AND (session IS NULL OR session = ANY(${sessionVariants}))
          GROUP BY COALESCE(NULLIF(TRIM(topic), ''), 'General')
          ORDER BY name
        `
      : await sql`
          SELECT
            COALESCE(NULLIF(TRIM(topic), ''), 'General') AS name,
            COUNT(*)::int AS deck_count,
            COALESCE(SUM(card_count), 0)::int AS card_count
          FROM flashcard_decks
          WHERE deck_kind = 'course'
            AND course_id = ${params.courseId}
            AND deleted_at IS NULL
          GROUP BY COALESCE(NULLIF(TRIM(topic), ''), 'General')
          ORDER BY name
        `

  const availability = await fetchModuleTopicAvailabilityForSession(
    "flashcards",
    session,
    sessionVariants,
  )

  return rows.map((row) => {
    const name = String(row.name)
    return {
      name,
      deck_count: Number(row.deck_count) || 0,
      card_count: Number(row.card_count) || 0,
      availability: {
        [session]: resolveModuleTopicAvailability(availability, name, session),
      },
    }
  })
}

export async function fetchFlashcardSectionCodes(courseId: number): Promise<string[]> {
  return listCourseSessionCodes(courseId)
}
