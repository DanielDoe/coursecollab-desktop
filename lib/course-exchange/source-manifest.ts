import { sql } from "@/lib/db"
import { normalizeModuleList } from "@/lib/course-exchange/modules"
import type { CourseExchangeModule } from "@/lib/course-exchange/types"
import type { ExchangeEntityType } from "@/lib/course-exchange/lineage-types"
import { contentFingerprint } from "@/lib/course-exchange/lineage-snapshot"

export type SourceManifestEntry = {
  key: string
  label: string
  fingerprint: string
  entityType: ExchangeEntityType
  module: CourseExchangeModule | "syllabus"
  sourceId: number
}

function itemKey(entityType: ExchangeEntityType, sourceId: number): string {
  return `${entityType}:${sourceId}`
}

function moduleForQuizType(assessmentType: string | null): CourseExchangeModule {
  const t = (assessmentType ?? "quiz").toLowerCase()
  if (t === "homework") return "homework"
  if (t === "mid_semester") return "mid_semester_exams"
  if (t === "final") return "final_exams"
  return "quizzes"
}

/** One round-trip per module type — avoids N+1 fingerprint queries. */
export async function buildSourceManifestBatch(
  sourceCourseId: number,
  modules: CourseExchangeModule[],
): Promise<Map<string, SourceManifestEntry>> {
  const out = new Map<string, SourceManifestEntry>()
  const normalized = normalizeModuleList(modules)

  if (normalized.includes("syllabus")) {
    const rows = (await sql`
      SELECT id, title, term, sections, content_mode, pdf_url, updated_at
      FROM course_syllabi WHERE course_id = ${sourceCourseId} LIMIT 1
    `) as {
      id: number
      title: string | null
      term: string | null
      sections: unknown
      content_mode: string | null
      pdf_url: string | null
      updated_at: string | null
    }[]
    const row = rows[0]
    if (row) {
      const key = itemKey("syllabus", row.id)
      out.set(key, {
        key,
        label: row.title?.trim() || "Course syllabus",
        fingerprint: contentFingerprint({
          title: row.title,
          term: row.term,
          sections: row.sections,
          content_mode: row.content_mode,
          pdf_url: row.pdf_url,
          updated_at: row.updated_at,
        }),
        entityType: "syllabus",
        module: "syllabus",
        sourceId: row.id,
      })
    }
  }

  if (normalized.includes("lectures")) {
    const rows = (await sql`
      SELECT id, title, week, session, description, updated_at
      FROM lectures
      WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
      ORDER BY id
    `) as { id: number; title: string; week: number | null; session: string | null; description: string | null; updated_at: string | null }[]
    for (const row of rows) {
      const key = itemKey("lecture", row.id)
      out.set(key, {
        key,
        label: row.title,
        fingerprint: contentFingerprint({
          title: row.title,
          week: row.week,
          session: row.session,
          description: row.description,
          updated_at: row.updated_at,
        }),
        entityType: "lecture",
        module: "lectures",
        sourceId: row.id,
      })
    }
  }

  if (normalized.includes("course_notes")) {
    const rows = (await sql`
      SELECT id, title, topic, body_text, updated_at
      FROM course_digital_notes
      WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
      ORDER BY id
    `) as { id: number; title: string; topic: string | null; body_text: string | null; updated_at: string | null }[]
    for (const row of rows) {
      const key = itemKey("course_note", row.id)
      out.set(key, {
        key,
        label: row.title,
        fingerprint: contentFingerprint({
          title: row.title,
          topic: row.topic,
          body_text: row.body_text,
          updated_at: row.updated_at,
        }),
        entityType: "course_note",
        module: "course_notes",
        sourceId: row.id,
      })
    }
  }

  if (normalized.includes("flashcards")) {
    const rows = (await sql`
      SELECT id, title, description, topic, card_count, updated_at
      FROM flashcard_decks
      WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL AND student_id IS NULL
      ORDER BY id
    `) as { id: number; title: string; description: string | null; topic: string | null; card_count: number; updated_at: string | null }[]
    for (const row of rows) {
      const key = itemKey("flashcard_deck", row.id)
      out.set(key, {
        key,
        label: row.title,
        fingerprint: contentFingerprint({
          title: row.title,
          description: row.description,
          topic: row.topic,
          card_count: row.card_count,
          updated_at: row.updated_at,
        }),
        entityType: "flashcard_deck",
        module: "flashcards",
        sourceId: row.id,
      })
    }
  }

  const assessmentModules = normalized.filter((m) =>
    ["quizzes", "homework", "mid_semester_exams", "final_exams"].includes(m),
  )
  if (assessmentModules.length > 0) {
    const rows = (await sql`
      SELECT id, title, description, assessment_type, updated_at
      FROM quizzes
      WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
      ORDER BY id
    `) as { id: number; title: string; description: string | null; assessment_type: string | null; updated_at: string | null }[]
    for (const row of rows) {
      const mod = moduleForQuizType(row.assessment_type)
      if (!assessmentModules.includes(mod)) continue
      const key = itemKey("quiz", row.id)
      out.set(key, {
        key,
        label: row.title,
        fingerprint: contentFingerprint({
          title: row.title,
          description: row.description,
          assessment_type: row.assessment_type,
          updated_at: row.updated_at,
        }),
        entityType: "quiz",
        module: mod,
        sourceId: row.id,
      })
    }
  }

  if (normalized.includes("question_bank")) {
    const rows = (await sql`
      SELECT id, topic, question_text, question_type, updated_at
      FROM question_bank
      WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
      ORDER BY id
    `) as { topic: string | null; question_text: string; question_type: string; updated_at: string | null; id: number }[]
    for (const row of rows) {
      const key = itemKey("question_bank", row.id)
      out.set(key, {
        key,
        label: `${row.topic?.trim() || "Question"} · ${row.question_type}`,
        fingerprint: contentFingerprint({
          topic: row.topic,
          question_text: row.question_text,
          question_type: row.question_type,
          updated_at: row.updated_at,
        }),
        entityType: "question_bank",
        module: "question_bank",
        sourceId: row.id,
      })
    }
  }

  return out
}

export function hashSourceManifest(entries: Iterable<SourceManifestEntry>): string {
  const parts = [...entries].map((e) => `${e.key}:${e.fingerprint}`).sort()
  return contentFingerprint(parts)
}
