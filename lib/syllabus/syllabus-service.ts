import { sql } from "@/lib/db"
import { ensureSyllabusSchema } from "@/lib/ensure-syllabus-schema"
import { getDefaultSyllabusTemplate } from "@/lib/syllabus/default-template"
import { parseSyllabusTemplateProvenance } from "@/lib/syllabus-exchange/provenance-shared"
import type { CourseSyllabus, CourseSyllabusPayload, SyllabusSection } from "@/lib/syllabus/types"

type SyllabusRow = {
  id: number
  course_id: number
  session_id: number | null
  title: string
  term: string
  status: string
  content_mode: string
  pdf_url: string | null
  pdf_file_name: string | null
  logo_url: string | null
  logo_file_name: string | null
  sections: unknown
  template_provenance: unknown
  created_by: number | null
  updated_by: number | null
  created_at: Date | string
  updated_at: Date | string
  published_at: Date | string | null
}

function parseSections(raw: unknown): SyllabusSection[] {
  if (!Array.isArray(raw)) return []
  return raw as SyllabusSection[]
}

function rowToSyllabus(row: SyllabusRow): CourseSyllabus {
  return {
    id: row.id,
    courseId: row.course_id,
    sessionId: row.session_id ?? null,
    title: row.title,
    term: row.term,
    status: row.status === "published" ? "published" : "draft",
    contentMode: row.content_mode === "pdf" ? "pdf" : "structured",
    pdfUrl: row.pdf_url ?? null,
    pdfFileName: row.pdf_file_name ?? null,
    logoUrl: row.logo_url ?? null,
    logoFileName: row.logo_file_name ?? null,
    sections: parseSections(row.sections),
    templateProvenance: parseSyllabusTemplateProvenance(row.template_provenance),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
  }
}

function sortSections(sections: SyllabusSection[]): SyllabusSection[] {
  return [...sections].sort((a, b) => a.order - b.order)
}

function normalizeSessionId(sessionId?: number | null): number | null {
  if (sessionId == null || !Number.isFinite(sessionId) || sessionId <= 0) return null
  return Math.trunc(sessionId)
}

export async function getSyllabusByCourseId(
  courseId: number,
  sessionId?: number | null,
): Promise<CourseSyllabus | null> {
  await ensureSyllabusSchema()
  const scopedSessionId = normalizeSessionId(sessionId)

  if (scopedSessionId != null) {
    const sessionRows = await sql`
      SELECT *
      FROM course_syllabi
      WHERE course_id = ${courseId}
        AND session_id = ${scopedSessionId}
      LIMIT 1
    `
    if (sessionRows.length) {
      const syllabus = rowToSyllabus(sessionRows[0] as SyllabusRow)
      syllabus.sections = sortSections(syllabus.sections)
      return syllabus
    }
  }

  const rows = await sql`
    SELECT *
    FROM course_syllabi
    WHERE course_id = ${courseId}
      AND session_id IS NULL
    LIMIT 1
  `
  if (!rows.length) return null
  const syllabus = rowToSyllabus(rows[0] as SyllabusRow)
  syllabus.sections = sortSections(syllabus.sections)
  return syllabus
}

export async function getOrCreateSyllabusForCourse(
  courseId: number,
  actorId?: number,
  sessionId?: number | null,
): Promise<CourseSyllabus> {
  const scopedSessionId = normalizeSessionId(sessionId)
  const existing = await getSyllabusByCourseId(courseId, scopedSessionId)
  if (existing) return existing

  const courseRows = await sql`
    SELECT course_code, course_title
    FROM courses
    WHERE id = ${courseId}
    LIMIT 1
  `
  const course = courseRows[0] as { course_code: string; course_title: string } | undefined
  const template = getDefaultSyllabusTemplate({
    courseCode: course?.course_code,
    courseTitle: course?.course_title,
  })

  const rows = await sql`
    INSERT INTO course_syllabi (
      course_id, session_id, title, term, status, sections, created_by, updated_by
    ) VALUES (
      ${courseId},
      ${scopedSessionId},
      ${template.title},
      ${template.term},
      'draft',
      ${JSON.stringify(template.sections)}::jsonb,
      ${actorId ?? null},
      ${actorId ?? null}
    )
    RETURNING *
  `
  const syllabus = rowToSyllabus(rows[0] as SyllabusRow)
  syllabus.sections = sortSections(syllabus.sections)
  return syllabus
}

function requireSyllabusRow(rows: unknown[], action: "save" | "publish"): SyllabusRow {
  const row = rows[0] as SyllabusRow | undefined
  if (!row) {
    throw new Error(
      action === "publish"
        ? "Unable to publish this syllabus."
        : "Unable to save this syllabus.",
    )
  }
  return row
}

export async function saveSyllabusDraft(
  courseId: number,
  payload: CourseSyllabusPayload,
  actorId: number,
  sessionId?: number | null,
): Promise<CourseSyllabus> {
  await ensureSyllabusSchema()
  const scopedSessionId = normalizeSessionId(sessionId)
  const existing = await getOrCreateSyllabusForCourse(courseId, actorId, scopedSessionId)
  const targetSessionId = normalizeSessionId(existing.sessionId)

  const sections = sortSections(payload.sections)
  const contentMode = payload.contentMode === "pdf" ? "pdf" : "structured"
  const rows = await sql`
    UPDATE course_syllabi
    SET
      title = ${payload.title ?? "Course Syllabus"},
      term = ${payload.term ?? ""},
      sections = ${JSON.stringify(sections)}::jsonb,
      content_mode = ${contentMode},
      status = 'draft',
      updated_by = ${actorId},
      updated_at = NOW()
    WHERE course_id = ${courseId}
      AND (
        (${targetSessionId}::int IS NULL AND session_id IS NULL)
        OR session_id = ${targetSessionId}
      )
    RETURNING *
  `
  const syllabus = rowToSyllabus(requireSyllabusRow(rows, "save"))
  syllabus.sections = sortSections(syllabus.sections)
  return syllabus
}

export async function publishSyllabus(
  courseId: number,
  payload: CourseSyllabusPayload,
  actorId: number,
  sessionId?: number | null,
): Promise<CourseSyllabus> {
  await ensureSyllabusSchema()
  const scopedSessionId = normalizeSessionId(sessionId)
  const existing = await getOrCreateSyllabusForCourse(courseId, actorId, scopedSessionId)
  const targetSessionId = normalizeSessionId(existing.sessionId)

  const sections = sortSections(payload.sections)
  const contentMode = payload.contentMode === "pdf" ? "pdf" : "structured"

  if (contentMode === "pdf") {
    const check = await sql`
      SELECT pdf_url FROM course_syllabi
      WHERE course_id = ${courseId}
        AND (
          (${targetSessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${targetSessionId}
        )
      LIMIT 1
    `
    const pdfUrl = (check[0] as { pdf_url?: string | null } | undefined)?.pdf_url
    if (!pdfUrl) {
      throw new Error("Upload a PDF syllabus before publishing.")
    }
  }

  const rows = await sql`
    UPDATE course_syllabi
    SET
      title = ${payload.title ?? "Course Syllabus"},
      term = ${payload.term ?? ""},
      sections = ${JSON.stringify(sections)}::jsonb,
      content_mode = ${contentMode},
      status = 'published',
      updated_by = ${actorId},
      updated_at = NOW(),
      published_at = NOW()
    WHERE course_id = ${courseId}
      AND (
        (${targetSessionId}::int IS NULL AND session_id IS NULL)
        OR session_id = ${targetSessionId}
      )
    RETURNING *
  `
  const syllabus = rowToSyllabus(requireSyllabusRow(rows, "publish"))
  syllabus.sections = sortSections(syllabus.sections)
  return syllabus
}
