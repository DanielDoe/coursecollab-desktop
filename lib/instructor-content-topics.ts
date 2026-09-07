import { sql } from "@/lib/db"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import {
  fetchModuleTopicAvailabilityForSession,
  resolveModuleTopicAvailability,
  type ContentModuleId,
} from "@/lib/module-topic-availability"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { ensureFlashcardSchema } from "@/lib/flashcards"
import { ensureCourseDigitalNotesSchema } from "@/lib/course-digital-notes"

export async function fetchQuestionBankTopicsForCourse(params: {
  courseId: number
  instructorId: number
  courseCode: string
  session?: string
  module: ContentModuleId
}) {
  const session = params.session?.trim() || "ALL"
  const sessionVariants = session !== "ALL" ? normalizedSectionVariantsForSql(session) : []

  const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
    "question_bank",
    "course_id",
    params.courseId,
    params.instructorId,
    { scopeCourseCode: params.courseCode },
  )

  const topics = await sql`
    SELECT topic, COUNT(*)::int AS question_count
    FROM question_bank
    WHERE topic IS NOT NULL AND topic != ''
      AND deleted_at IS NULL
      AND (${qbScope})
    GROUP BY topic
    ORDER BY topic
  `

  const availability = await fetchModuleTopicAvailabilityForSession(
    params.module,
    session,
    sessionVariants,
  )

  let deckCounts: { topic: string; deck_count: number; card_count: number }[] = []
  if (params.module === "flashcards") {
    await ensureFlashcardSchema()
    deckCounts = (await sql`
      SELECT
        COALESCE(topic, 'Untitled topic') AS topic,
        COUNT(*)::int AS deck_count,
        COALESCE(SUM(card_count), 0)::int AS card_count
      FROM flashcard_decks
      WHERE deck_kind = 'course' AND course_id = ${params.courseId}
      GROUP BY COALESCE(topic, 'Untitled topic')
    `) as { topic: string; deck_count: number; card_count: number }[]
  }

  let noteCounts: { topic: string; note_count: number }[] = []
  if (params.module === "course_notes") {
    await ensureCourseDigitalNotesSchema()
    noteCounts = (await sql`
      SELECT
        COALESCE(topic, 'Untitled topic') AS topic,
        COUNT(*)::int AS note_count
      FROM course_digital_notes
      WHERE course_id = ${params.courseId}
      GROUP BY COALESCE(topic, 'Untitled topic')
    `) as { topic: string; note_count: number }[]
  }

  return topics.map((topic) => {
    const name = String(topic.topic)
    const avail = resolveModuleTopicAvailability(availability, name, session)
    const decks = deckCounts.find((d) => d.topic === name)
    const notes = noteCounts.find((n) => n.topic === name)
    return {
      name,
      question_count: Number(topic.question_count),
      deck_count: decks?.deck_count ?? 0,
      card_count: decks?.card_count ?? 0,
      note_count: notes?.note_count ?? 0,
      availability: {
        [session]: {
          is_available: avail.is_available,
          updated_at: new Date().toISOString(),
          configured: avail.configured,
        },
      },
    }
  })
}
