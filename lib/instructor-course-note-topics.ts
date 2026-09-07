import { sql } from "@/lib/db"
import {
  fetchModuleTopicAvailabilityForSession,
  resolveModuleTopicAvailability,
} from "@/lib/module-topic-availability"
import type { ModuleContentSessionFilter } from "@/lib/module-content-session-scope"
import { moduleContentSessionFilterLabel } from "@/lib/module-content-session-scope"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { ensureCourseDigitalNotesSchema } from "@/lib/course-digital-notes"

export type CourseNoteSectionAvailability = {
  is_available: boolean
  configured: boolean
}

export type CourseNoteConfigSection = {
  id: number
  code: string
  studentCount: number
}

export type CourseNoteConfigTopic = {
  name: string
  note_count: number
  availability: Record<string, CourseNoteSectionAvailability>
}

export type CourseNoteConfiguration = {
  sections: CourseNoteConfigSection[]
  topics: CourseNoteConfigTopic[]
}

function dedupeConfigSections(
  rows: { id?: number; code: string; student_count?: number }[],
): CourseNoteConfigSection[] {
  const map = new Map<string, CourseNoteConfigSection>()
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

export async function fetchCourseNoteConfiguration(courseId: number): Promise<CourseNoteConfiguration> {
  await ensureCourseDigitalNotesSchema()

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

  const availabilityBySection = new Map<
    string,
    Awaited<ReturnType<typeof fetchModuleTopicAvailabilityForSession>>
  >()
  for (const code of sectionKeys) {
    const variants = code !== "ALL" ? normalizedSectionVariantsForSql(code) : []
    availabilityBySection.set(
      code,
      await fetchModuleTopicAvailabilityForSession("course_notes", code, variants),
    )
  }

  const topicRows = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(topic), ''), 'General') AS name,
      COUNT(*)::int AS note_count
    FROM course_digital_notes
    WHERE course_id = ${courseId}
      AND deleted_at IS NULL
    GROUP BY COALESCE(NULLIF(TRIM(topic), ''), 'General')
    ORDER BY name
  `

  const topics: CourseNoteConfigTopic[] = topicRows.map((row) => {
    const name = String(row.name)
    const availability: Record<string, CourseNoteSectionAvailability> = {}
    for (const code of sectionKeys) {
      availability[code] = resolveModuleTopicAvailability(
        availabilityBySection.get(code) ?? [],
        name,
        code,
      )
    }
    return {
      name,
      note_count: Number(row.note_count) || 0,
      availability,
    }
  })

  return { sections, topics }
}

export async function fetchCourseNoteTopicsForCourse(params: {
  courseId: number
  sessionFilter?: ModuleContentSessionFilter
  /** @deprecated Use sessionFilter */
  session?: string
}): Promise<
  {
    name: string
    note_count: number
    availability: Record<string, CourseNoteSectionAvailability>
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

  await ensureCourseDigitalNotesSchema()

  const rows =
    sessionFilter.mode === "section"
      ? await sql`
          SELECT
            COALESCE(NULLIF(TRIM(topic), ''), 'General') AS name,
            COUNT(*)::int AS note_count
          FROM course_digital_notes
          WHERE course_id = ${params.courseId}
            AND deleted_at IS NULL
            AND (session IS NULL OR session = ANY(${sessionVariants}))
          GROUP BY COALESCE(NULLIF(TRIM(topic), ''), 'General')
          ORDER BY name
        `
      : await sql`
          SELECT
            COALESCE(NULLIF(TRIM(topic), ''), 'General') AS name,
            COUNT(*)::int AS note_count
          FROM course_digital_notes
          WHERE course_id = ${params.courseId}
            AND deleted_at IS NULL
          GROUP BY COALESCE(NULLIF(TRIM(topic), ''), 'General')
          ORDER BY name
        `

  const availability = await fetchModuleTopicAvailabilityForSession(
    "course_notes",
    session,
    sessionVariants,
  )

  return rows.map((row) => {
    const name = String(row.name)
    return {
      name,
      note_count: Number(row.note_count) || 0,
      availability: {
        [session]: resolveModuleTopicAvailability(availability, name, session),
      },
    }
  })
}
