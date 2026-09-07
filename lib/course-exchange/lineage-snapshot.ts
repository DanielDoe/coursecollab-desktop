import { createHash } from "crypto"
import { sql } from "@/lib/db"
import { modulesInclude } from "@/lib/course-exchange/modules"
import type { CloneIdMaps } from "@/lib/course-exchange/types"
import type { CourseExchangeModule } from "@/lib/course-exchange/types"
import type { ExchangeEntityType, ExchangeLineage, ExchangeLineageItem } from "@/lib/course-exchange/lineage-types"
import { normalizeLectureDedupeKey } from "@/lib/lecture-index-label"

export function contentFingerprint(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24)
}

function itemKey(entityType: ExchangeEntityType, sourceId: number): string {
  return `${entityType}:${sourceId}`
}

function parseLineageItem(raw: unknown): ExchangeLineageItem | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.key !== "string" || typeof o.sourceId !== "number" || typeof o.destinationId !== "number") {
    return null
  }
  return {
    key: o.key,
    module: o.module as ExchangeLineageItem["module"],
    entityType: o.entityType as ExchangeEntityType,
    sourceId: o.sourceId,
    destinationId: o.destinationId,
    label: String(o.label ?? ""),
    fingerprint: String(o.fingerprint ?? ""),
  }
}

export function parseExchangeLineage(raw: unknown): ExchangeLineage | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const items = Array.isArray(o.items)
    ? o.items.map(parseLineageItem).filter((x): x is ExchangeLineageItem => x != null)
    : []
  if (items.length === 0 && !Array.isArray(o.items)) return null
  return {
    version: Number(o.version ?? 1),
    syncedAt: String(o.syncedAt ?? new Date().toISOString()),
    modules: Array.isArray(o.modules) ? (o.modules as CourseExchangeModule[]) : [],
    items,
  }
}

export function emptyReuseMaps(): CloneIdMaps {
  return {
    questionBank: new Map(),
    quizzes: new Map(),
    lectures: new Map(),
    flashcardDecks: new Map(),
    groups: new Map(),
    playgroundSessions: new Map(),
    courseNotes: new Map(),
  }
}

/** Primary mappings win; secondary fills unmapped source ids only. */
export function mergeReuseMaps(primary: CloneIdMaps, secondary: CloneIdMaps): CloneIdMaps {
  const merged = emptyReuseMaps()
  for (const key of Object.keys(merged) as (keyof CloneIdMaps)[]) {
    for (const [sourceId, destId] of secondary[key]) {
      merged[key].set(sourceId, destId)
    }
    for (const [sourceId, destId] of primary[key]) {
      merged[key].set(sourceId, destId)
    }
  }
  return merged
}

export function lectureExchangeMatchKey(week: number | null, title: string): string {
  const w = Number.isFinite(Number(week)) ? Number(week) : 0
  return `${w}:${normalizeLectureDedupeKey(String(title ?? ""))}`
}

function normalizeGroupMatchKey(
  name: string,
  sessionId: number | null | undefined,
  session: string | null | undefined,
): string {
  const n = String(name ?? "").trim().toLowerCase()
  if (sessionId != null && Number.isFinite(Number(sessionId)) && Number(sessionId) > 0) {
    return `${n}:sid:${Math.trunc(Number(sessionId))}`
  }
  return `${n}:code:${String(session ?? "").trim().toLowerCase()}`
}

function normalizeQuizMatchKey(title: string, assessmentType: string | null | undefined): string {
  return `${String(title ?? "").trim().toLowerCase()}:${String(assessmentType ?? "quiz").trim().toLowerCase()}`
}

function normalizeDeckMatchKey(title: string, topic: string | null | undefined): string {
  return `${String(title ?? "").trim().toLowerCase()}:${String(topic ?? "").trim().toLowerCase()}`
}

/** Match source rows to existing destination content so clones skip duplicates. */
export async function buildDestinationReuseMaps(input: {
  sourceCourseId: number
  destinationCourseId: number
  modules: CourseExchangeModule[]
  destinationSessionCode?: string | null
  destinationSessionId?: number | null
}): Promise<CloneIdMaps> {
  const maps = emptyReuseMaps()
  const destSession =
    input.destinationSessionCode != null && String(input.destinationSessionCode).trim()
      ? String(input.destinationSessionCode).trim()
      : null
  const destSessionId =
    input.destinationSessionId != null &&
    Number.isFinite(Number(input.destinationSessionId)) &&
    Number(input.destinationSessionId) > 0
      ? Math.trunc(Number(input.destinationSessionId))
      : null
  const { groupsHasSessionId } = await import("@/lib/instructor-default-courses").then((m) =>
    m.getGroupsProjectsCourseIdColumns(),
  )

  if (modulesInclude(input.modules, "lectures")) {
    const src = (await sql`
      SELECT id, week, title FROM lectures
      WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; week: number | null; title: string }[]
    const dest = (await sql`
      SELECT id, week, title FROM lectures
      WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; week: number | null; title: string }[]
    const destByKey = new Map(dest.map((d) => [lectureExchangeMatchKey(d.week, d.title), d.id]))
    for (const s of src) {
      const key = lectureExchangeMatchKey(s.week, s.title)
      const destId = destByKey.get(key)
      if (destId) maps.lectures.set(s.id, destId)
    }
    for (const s of src) {
      if (maps.lectures.has(s.id)) continue
      const key = lectureExchangeMatchKey(s.week, s.title)
      const peer = src.find(
        (other) =>
          other.id !== s.id &&
          lectureExchangeMatchKey(other.week, other.title) === key &&
          maps.lectures.has(other.id),
      )
      if (peer) {
        const destId = maps.lectures.get(peer.id)
        if (destId) maps.lectures.set(s.id, destId)
      }
    }
  }

  if (modulesInclude(input.modules, "course_notes")) {
    const src = (await sql`
      SELECT id, title FROM course_digital_notes
      WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; title: string }[]
    const dest = (await sql`
      SELECT id, title FROM course_digital_notes
      WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; title: string }[]
    const destByTitle = new Map(dest.map((d) => [d.title.trim().toLowerCase(), d.id]))
    for (const s of src) {
      const destId = destByTitle.get(s.title.trim().toLowerCase())
      if (destId) maps.courseNotes.set(s.id, destId)
    }
  }

  if (modulesInclude(input.modules, "flashcards")) {
    const src = (await sql`
      SELECT id, title, topic FROM flashcard_decks
      WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL AND student_id IS NULL ORDER BY id
    `) as { id: number; title: string; topic: string | null }[]
    const dest = (await sql`
      SELECT id, title, topic FROM flashcard_decks
      WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL AND student_id IS NULL ORDER BY id
    `) as { id: number; title: string; topic: string | null }[]
    const destByKey = new Map(dest.map((d) => [normalizeDeckMatchKey(d.title, d.topic), d.id]))
    for (const s of src) {
      const destId = destByKey.get(normalizeDeckMatchKey(s.title, s.topic))
      if (destId) maps.flashcardDecks.set(s.id, destId)
    }
  }

  if (
    input.modules.some((m) =>
      ["quizzes", "homework", "mid_semester_exams", "final_exams"].includes(m),
    )
  ) {
    const src = (await sql`
      SELECT id, title, assessment_type FROM quizzes
      WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; title: string; assessment_type: string | null }[]
    const dest = (await sql`
      SELECT id, title, assessment_type FROM quizzes
      WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; title: string; assessment_type: string | null }[]
    const destByKey = new Map(
      dest.map((d) => [normalizeQuizMatchKey(d.title, d.assessment_type), d.id]),
    )
    for (const s of src) {
      const destId = destByKey.get(normalizeQuizMatchKey(s.title, s.assessment_type))
      if (destId) maps.quizzes.set(s.id, destId)
    }
  }

  if (modulesInclude(input.modules, "playground")) {
    const src = (await sql`
      SELECT id, session_code FROM playground_sessions WHERE course_id = ${input.sourceCourseId} ORDER BY id
    `) as { id: number; session_code: string }[]
    const dest = (await sql`
      SELECT id, session_code FROM playground_sessions WHERE course_id = ${input.destinationCourseId} ORDER BY id
    `) as { id: number; session_code: string }[]
    const destByCode = new Map(
      dest.map((d) => [d.session_code.replace(/-cx\d+$/, "").toLowerCase(), d.id]),
    )
    for (const s of src) {
      const baseCode = s.session_code.toLowerCase()
      const destId =
        destByCode.get(baseCode) ?? dest.find((d) => d.session_code.startsWith(s.session_code))?.id
      if (destId) maps.playgroundSessions.set(s.id, destId)
    }
  }

  if (modulesInclude(input.modules, "question_bank")) {
    const src = (await sql`
      SELECT id, topic, question_text FROM question_bank
      WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; topic: string | null; question_text: string }[]
    const dest = (await sql`
      SELECT id, topic, question_text FROM question_bank
      WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL ORDER BY id
    `) as { id: number; topic: string | null; question_text: string }[]
    const destKey = new Map(
      dest.map((d) => [
        contentFingerprint({ topic: d.topic, question_text: d.question_text }),
        d.id,
      ]),
    )
    for (const s of src) {
      const destId = destKey.get(contentFingerprint({ topic: s.topic, question_text: s.question_text }))
      if (destId) maps.questionBank.set(s.id, destId)
    }
  }

  if (modulesInclude(input.modules, "groups") || modulesInclude(input.modules, "projects")) {
    const src = groupsHasSessionId
      ? ((await sql`
          SELECT id, name, session, session_id FROM groups
          WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL AND status = 'approved'
          ORDER BY id
        `) as { id: number; name: string; session: string | null; session_id: number | null }[])
      : ((await sql`
          SELECT id, name, session FROM groups
          WHERE course_id = ${input.sourceCourseId} AND deleted_at IS NULL AND status = 'approved'
          ORDER BY id
        `) as { id: number; name: string; session: string | null; session_id?: number | null }[])
    const dest = groupsHasSessionId
      ? ((await sql`
          SELECT id, name, session, session_id FROM groups
          WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL AND status = 'approved'
          ORDER BY id
        `) as { id: number; name: string; session: string | null; session_id: number | null }[])
      : ((await sql`
          SELECT id, name, session FROM groups
          WHERE course_id = ${input.destinationCourseId} AND deleted_at IS NULL AND status = 'approved'
          ORDER BY id
        `) as { id: number; name: string; session: string | null; session_id?: number | null }[])
    const destByKey = new Map(
      dest.map((d) => [
        normalizeGroupMatchKey(d.name, d.session_id ?? null, d.session),
        d.id,
      ]),
    )
    for (const s of src) {
      const sessionCode = destSession ?? s.session
      const matchSessionId = destSessionId ?? s.session_id ?? null
      const destId = destByKey.get(normalizeGroupMatchKey(s.name, matchSessionId, sessionCode))
      if (destId) maps.groups.set(s.id, destId)
    }
  }

  return maps
}

export function lineageToIdMaps(lineage: ExchangeLineage): CloneIdMaps {
  const maps: CloneIdMaps = {
    questionBank: new Map(),
    quizzes: new Map(),
    lectures: new Map(),
    flashcardDecks: new Map(),
    groups: new Map(),
    playgroundSessions: new Map(),
    courseNotes: new Map(),
  }
  for (const item of lineage.items) {
    switch (item.entityType) {
      case "question_bank":
        maps.questionBank.set(item.sourceId, item.destinationId)
        break
      case "lecture":
        maps.lectures.set(item.sourceId, item.destinationId)
        break
      case "course_note":
        maps.courseNotes.set(item.sourceId, item.destinationId)
        break
      case "flashcard_deck":
        maps.flashcardDecks.set(item.sourceId, item.destinationId)
        break
      case "quiz":
        maps.quizzes.set(item.sourceId, item.destinationId)
        break
      case "playground_session":
        maps.playgroundSessions.set(item.sourceId, item.destinationId)
        break
      default:
        break
    }
  }
  return maps
}

async function fingerprintQuestion(sourceId: number): Promise<{ label: string; fingerprint: string }> {
  const rows = (await sql`
    SELECT topic, question_text, question_type, updated_at
    FROM question_bank WHERE id = ${sourceId} LIMIT 1
  `) as { topic: string | null; question_text: string; question_type: string; updated_at: string | null }[]
  const row = rows[0]
  if (!row) return { label: `Question #${sourceId}`, fingerprint: "missing" }
  const label = `${row.topic?.trim() || "Question"} · ${row.question_type}`
  return {
    label,
    fingerprint: contentFingerprint({
      topic: row.topic,
      question_text: row.question_text,
      question_type: row.question_type,
      updated_at: row.updated_at,
    }),
  }
}

async function fingerprintLecture(sourceId: number): Promise<{ label: string; fingerprint: string }> {
  const rows = (await sql`
    SELECT title, week, session, description, updated_at
    FROM lectures WHERE id = ${sourceId} AND deleted_at IS NULL LIMIT 1
  `) as { title: string; week: number | null; session: string | null; description: string | null; updated_at: string | null }[]
  const row = rows[0]
  if (!row) return { label: `Lecture #${sourceId}`, fingerprint: "missing" }
  return {
    label: row.title,
    fingerprint: contentFingerprint({
      title: row.title,
      week: row.week,
      session: row.session,
      description: row.description,
      updated_at: row.updated_at,
    }),
  }
}

async function fingerprintNote(sourceId: number): Promise<{ label: string; fingerprint: string }> {
  const rows = (await sql`
    SELECT title, topic, body_text, updated_at
    FROM course_digital_notes WHERE id = ${sourceId} AND deleted_at IS NULL LIMIT 1
  `) as { title: string; topic: string | null; body_text: string | null; updated_at: string | null }[]
  const row = rows[0]
  if (!row) return { label: `Note #${sourceId}`, fingerprint: "missing" }
  return {
    label: row.title,
    fingerprint: contentFingerprint({
      title: row.title,
      topic: row.topic,
      body_text: row.body_text,
      updated_at: row.updated_at,
    }),
  }
}

async function fingerprintDeck(sourceId: number): Promise<{ label: string; fingerprint: string }> {
  const rows = (await sql`
    SELECT title, description, topic, card_count, updated_at
    FROM flashcard_decks WHERE id = ${sourceId} AND deleted_at IS NULL LIMIT 1
  `) as { title: string; description: string | null; topic: string | null; card_count: number; updated_at: string | null }[]
  const row = rows[0]
  if (!row) return { label: `Deck #${sourceId}`, fingerprint: "missing" }
  return {
    label: row.title,
    fingerprint: contentFingerprint({
      title: row.title,
      description: row.description,
      topic: row.topic,
      card_count: row.card_count,
      updated_at: row.updated_at,
    }),
  }
}

async function fingerprintQuiz(sourceId: number): Promise<{ label: string; fingerprint: string }> {
  const rows = (await sql`
    SELECT title, description, assessment_type, updated_at
    FROM quizzes WHERE id = ${sourceId} AND deleted_at IS NULL LIMIT 1
  `) as { title: string; description: string | null; assessment_type: string | null; updated_at: string | null }[]
  const row = rows[0]
  if (!row) return { label: `Assessment #${sourceId}`, fingerprint: "missing" }
  return {
    label: row.title,
    fingerprint: contentFingerprint({
      title: row.title,
      description: row.description,
      assessment_type: row.assessment_type,
      updated_at: row.updated_at,
    }),
  }
}

async function fingerprintPlayground(sourceId: number): Promise<{ label: string; fingerprint: string }> {
  const rows = (await sql`
    SELECT session_code, selected_topics, question_count, created_at
    FROM playground_sessions WHERE id = ${sourceId} LIMIT 1
  `) as { session_code: string; selected_topics: unknown; question_count: number | null; created_at: string | null }[]
  const row = rows[0]
  if (!row) return { label: `Playground #${sourceId}`, fingerprint: "missing" }
  return {
    label: row.session_code,
    fingerprint: contentFingerprint({
      session_code: row.session_code,
      selected_topics: row.selected_topics,
      question_count: row.question_count,
      created_at: row.created_at,
    }),
  }
}

async function fingerprintSyllabus(sourceCourseId: number): Promise<{ sourceId: number; label: string; fingerprint: string } | null> {
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
  if (!row) return null
  return {
    sourceId: row.id,
    label: row.title?.trim() || "Course syllabus",
    fingerprint: contentFingerprint({
      title: row.title,
      term: row.term,
      sections: row.sections,
      content_mode: row.content_mode,
      pdf_url: row.pdf_url,
      updated_at: row.updated_at,
    }),
  }
}

function moduleForQuizType(assessmentType: string | null): CourseExchangeModule {
  const t = (assessmentType ?? "quiz").toLowerCase()
  if (t === "homework") return "homework"
  if (t === "mid_semester") return "mid_semester_exams"
  if (t === "final") return "final_exams"
  if (t === "quiz") return "quizzes"
  return "quizzes"
}

/** Build lineage snapshot after a successful clone (or rebuild from paired maps). */
export async function buildExchangeLineage(input: {
  sourceCourseId: number
  destinationCourseId: number
  maps: CloneIdMaps
  modules: CourseExchangeModule[]
  version?: number
}): Promise<ExchangeLineage> {
  const items: ExchangeLineageItem[] = []

  if (input.modules.includes("syllabus")) {
    const syllabus = await fingerprintSyllabus(input.sourceCourseId)
    if (syllabus) {
      items.push({
        key: itemKey("syllabus", syllabus.sourceId),
        module: "syllabus",
        entityType: "syllabus",
        sourceId: syllabus.sourceId,
        destinationId: input.destinationCourseId,
        label: syllabus.label,
        fingerprint: syllabus.fingerprint,
      })
    }
  }

  for (const [sourceId, destinationId] of input.maps.lectures) {
    const meta = await fingerprintLecture(sourceId)
    items.push({
      key: itemKey("lecture", sourceId),
      module: "lectures",
      entityType: "lecture",
      sourceId,
      destinationId,
      label: meta.label,
      fingerprint: meta.fingerprint,
    })
  }

  for (const [sourceId, destinationId] of input.maps.courseNotes) {
    const meta = await fingerprintNote(sourceId)
    items.push({
      key: itemKey("course_note", sourceId),
      module: "course_notes",
      entityType: "course_note",
      sourceId,
      destinationId,
      label: meta.label,
      fingerprint: meta.fingerprint,
    })
  }

  for (const [sourceId, destinationId] of input.maps.flashcardDecks) {
    const meta = await fingerprintDeck(sourceId)
    items.push({
      key: itemKey("flashcard_deck", sourceId),
      module: "flashcards",
      entityType: "flashcard_deck",
      sourceId,
      destinationId,
      label: meta.label,
      fingerprint: meta.fingerprint,
    })
  }

  for (const [sourceId, destinationId] of input.maps.quizzes) {
    const meta = await fingerprintQuiz(sourceId)
    const typeRows = (await sql`
      SELECT assessment_type FROM quizzes WHERE id = ${sourceId} LIMIT 1
    `) as { assessment_type: string | null }[]
    items.push({
      key: itemKey("quiz", sourceId),
      module: moduleForQuizType(typeRows[0]?.assessment_type ?? null),
      entityType: "quiz",
      sourceId,
      destinationId,
      label: meta.label,
      fingerprint: meta.fingerprint,
    })
  }

  for (const [sourceId, destinationId] of input.maps.playgroundSessions) {
    const meta = await fingerprintPlayground(sourceId)
    items.push({
      key: itemKey("playground_session", sourceId),
      module: "playground",
      entityType: "playground_session",
      sourceId,
      destinationId,
      label: meta.label,
      fingerprint: meta.fingerprint,
    })
  }

  for (const [sourceId, destinationId] of input.maps.questionBank) {
    const meta = await fingerprintQuestion(sourceId)
    items.push({
      key: itemKey("question_bank", sourceId),
      module: "question_bank",
      entityType: "question_bank",
      sourceId,
      destinationId,
      label: meta.label,
      fingerprint: meta.fingerprint,
    })
  }

  return {
    version: input.version ?? 1,
    syncedAt: new Date().toISOString(),
    modules: input.modules,
    items,
  }
}

export async function rebuildLineageByTitleMatch(input: {
  sourceCourseId: number
  destinationCourseId: number
  modules: CourseExchangeModule[]
  destinationSessionCode?: string | null
}): Promise<ExchangeLineage> {
  const maps = await buildDestinationReuseMaps(input)
  return buildExchangeLineage({
    sourceCourseId: input.sourceCourseId,
    destinationCourseId: input.destinationCourseId,
    maps,
    modules: input.modules,
    version: 1,
  })
}

export { fingerprintQuestion, fingerprintLecture, fingerprintNote, fingerprintDeck, fingerprintQuiz, fingerprintSyllabus }
