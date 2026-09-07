import { sql } from "@/lib/db"
import { ensureSyllabusSchema } from "@/lib/ensure-syllabus-schema"
import { cloneSectionsForTemplate } from "@/lib/syllabus-exchange/clone-sections"
import { ensureSyllabusExchangeSchema } from "@/lib/syllabus-exchange/schema"
import type {
  DiscoverableSyllabusRow,
  SyllabusTemplateProvenance,
} from "@/lib/syllabus-exchange/types"
import {
  getOrCreateSyllabusForCourse,
  getSyllabusByCourseId,
} from "@/lib/syllabus/syllabus-service"
import type { CourseSyllabus, SyllabusSection } from "@/lib/syllabus/types"

type DiscoverParams = {
  requesterInstructorId: number
  query?: string | null
  limit?: number
}

type ApplyParams = {
  sourceSyllabusId: number
  destinationCourseId: number
  destinationSessionId: number | null
  destinationInstructorId: number
}

function normalizeSessionId(sessionId?: number | null): number | null {
  if (sessionId == null || !Number.isFinite(sessionId) || sessionId <= 0) return null
  return Math.trunc(sessionId)
}

function rowToDiscoverable(
  row: Record<string, unknown>,
  requesterInstructorId: number,
): DiscoverableSyllabusRow {
  const sections = Array.isArray(row.sections) ? row.sections : []
  return {
    syllabusId: Number(row.syllabus_id),
    courseId: Number(row.course_id),
    sessionId: row.session_id != null ? Number(row.session_id) : null,
    courseCode: String(row.course_code ?? ""),
    courseTitle: String(row.course_title ?? ""),
    sessionCode: row.session_code != null ? String(row.session_code) : null,
    university: row.university != null ? String(row.university) : null,
    title: String(row.title ?? ""),
    term: String(row.term ?? ""),
    status: row.status === "published" ? "published" : "draft",
    contentMode: row.content_mode === "pdf" ? "pdf" : "structured",
    sectionCount: sections.length,
    hasPdf: Boolean(row.pdf_url),
    instructorId: Number(row.instructor_id),
    instructorName: String(row.instructor_name ?? "Instructor"),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    isOwnCourse: Number(row.instructor_id) === requesterInstructorId,
  }
}

export async function listDiscoverableSyllabi(
  params: DiscoverParams,
): Promise<DiscoverableSyllabusRow[]> {
  await ensureSyllabusSchema()
  await ensureSyllabusExchangeSchema()

  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100)
  const q = params.query?.trim() ?? ""

  const rows = q
    ? await sql`
        SELECT
          cs.id AS syllabus_id,
          cs.course_id,
          cs.session_id,
          cs.title,
          cs.term,
          cs.status,
          cs.content_mode,
          cs.sections,
          cs.pdf_url,
          cs.published_at,
          cs.updated_at,
          c.course_code,
          c.course_title,
          c.instructor_id,
          c.university,
          i.name AS instructor_name,
          sess.code AS session_code
        FROM course_syllabi cs
        INNER JOIN courses c ON c.id = cs.course_id
        INNER JOIN instructors i ON i.id = c.instructor_id
        LEFT JOIN sessions sess ON sess.id = cs.session_id
        WHERE c.is_active = true
          AND (
            cs.status = 'published'
            OR jsonb_array_length(cs.sections) > 0
            OR cs.pdf_url IS NOT NULL
          )
          AND (
            c.course_code ILIKE ${"%" + q + "%"}
            OR c.course_title ILIKE ${"%" + q + "%"}
            OR cs.title ILIKE ${"%" + q + "%"}
            OR cs.term ILIKE ${"%" + q + "%"}
            OR i.name ILIKE ${"%" + q + "%"}
            OR COALESCE(sess.code, '') ILIKE ${"%" + q + "%"}
          )
        ORDER BY
          CASE WHEN cs.status = 'published' THEN 0 ELSE 1 END,
          cs.updated_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          cs.id AS syllabus_id,
          cs.course_id,
          cs.session_id,
          cs.title,
          cs.term,
          cs.status,
          cs.content_mode,
          cs.sections,
          cs.pdf_url,
          cs.published_at,
          cs.updated_at,
          c.course_code,
          c.course_title,
          c.instructor_id,
          c.university,
          i.name AS instructor_name,
          sess.code AS session_code
        FROM course_syllabi cs
        INNER JOIN courses c ON c.id = cs.course_id
        INNER JOIN instructors i ON i.id = c.instructor_id
        LEFT JOIN sessions sess ON sess.id = cs.session_id
        WHERE c.is_active = true
          AND (
            cs.status = 'published'
            OR jsonb_array_length(cs.sections) > 0
            OR cs.pdf_url IS NOT NULL
          )
        ORDER BY
          CASE WHEN cs.status = 'published' THEN 0 ELSE 1 END,
          cs.updated_at DESC
        LIMIT ${limit}
      `

  return rows.map((row) =>
    rowToDiscoverable(row as Record<string, unknown>, params.requesterInstructorId),
  )
}

export async function getDiscoverableSyllabusPreview(
  syllabusId: number,
  requesterInstructorId: number,
): Promise<{ row: DiscoverableSyllabusRow; sections: SyllabusSection[] } | null> {
  await ensureSyllabusSchema()

  const rows = await sql`
    SELECT
      cs.id AS syllabus_id,
      cs.course_id,
      cs.session_id,
      cs.title,
      cs.term,
      cs.status,
      cs.content_mode,
      cs.sections,
      cs.pdf_url,
      cs.published_at,
      cs.updated_at,
      c.course_code,
      c.course_title,
      c.instructor_id,
      c.university,
      i.name AS instructor_name,
      sess.code AS session_code
    FROM course_syllabi cs
    INNER JOIN courses c ON c.id = cs.course_id
    INNER JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN sessions sess ON sess.id = cs.session_id
    WHERE cs.id = ${syllabusId}
      AND c.is_active = true
    LIMIT 1
  `
  if (!rows.length) return null

  const row = rowToDiscoverable(rows[0] as Record<string, unknown>, requesterInstructorId)
  const sections = Array.isArray((rows[0] as { sections: unknown }).sections)
    ? ((rows[0] as { sections: SyllabusSection[] }).sections as SyllabusSection[])
    : []
  return { row, sections }
}

export async function applySyllabusTemplate(params: ApplyParams): Promise<CourseSyllabus> {
  await ensureSyllabusSchema()
  await ensureSyllabusExchangeSchema()

  const destinationSessionId = normalizeSessionId(params.destinationSessionId)
  const preview = await getDiscoverableSyllabusPreview(
    params.sourceSyllabusId,
    params.destinationInstructorId,
  )
  if (!preview) {
    throw new Error("Source syllabus not found.")
  }

  const sourceRows = await sql`
    SELECT cs.*, c.instructor_id, c.course_code, c.course_title, i.name AS instructor_name,
           sess.code AS session_code
    FROM course_syllabi cs
    INNER JOIN courses c ON c.id = cs.course_id
    INNER JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN sessions sess ON sess.id = cs.session_id
    WHERE cs.id = ${params.sourceSyllabusId}
    LIMIT 1
  `
  if (!sourceRows.length) throw new Error("Source syllabus not found.")

  const source = sourceRows[0] as {
    id: number
    course_id: number
    session_id: number | null
    title: string
    term: string
    content_mode: string
    sections: SyllabusSection[]
    pdf_url: string | null
    pdf_file_name: string | null
    logo_url: string | null
    logo_file_name: string | null
    instructor_id: number
    instructor_name: string
    course_code: string
    course_title: string
    session_code: string | null
  }

  const sameCourse = source.course_id === params.destinationCourseId
  const sameScope =
    sameCourse &&
    normalizeSessionId(source.session_id) === destinationSessionId

  if (sameScope) {
    throw new Error("This syllabus is already assigned to the selected course section.")
  }

  await getOrCreateSyllabusForCourse(
    params.destinationCourseId,
    params.destinationInstructorId,
    destinationSessionId,
  )

  const clonedSections = cloneSectionsForTemplate(
    Array.isArray(source.sections) ? source.sections : [],
    sameCourse,
  )

  const contentMode = source.content_mode === "pdf" ? "pdf" : "structured"
  const pdfUrl = sameCourse ? source.pdf_url : null
  const pdfFileName = sameCourse ? source.pdf_file_name : null
  const logoUrl = sameCourse ? source.logo_url : null
  const logoFileName = sameCourse ? source.logo_file_name : null

  const updated = await sql`
    UPDATE course_syllabi
    SET
      title = ${source.title},
      term = ${source.term},
      sections = ${JSON.stringify(clonedSections)}::jsonb,
      content_mode = ${contentMode},
      pdf_url = ${pdfUrl},
      pdf_file_name = ${pdfFileName},
      logo_url = ${logoUrl},
      logo_file_name = ${logoFileName},
      status = 'draft',
      updated_by = ${params.destinationInstructorId},
      updated_at = NOW()
    WHERE course_id = ${params.destinationCourseId}
      AND (
        (${destinationSessionId}::int IS NULL AND session_id IS NULL)
        OR session_id = ${destinationSessionId}
      )
    RETURNING id
  `
  const destinationSyllabusId = Number((updated[0] as { id: number }).id)

  const copiedAt = new Date().toISOString()
  const attribution: SyllabusTemplateProvenance = {
    sourceSyllabusId: source.id,
    sourceCourseId: source.course_id,
    sourceCourseCode: source.course_code,
    sourceCourseTitle: source.course_title,
    sourceInstructorId: source.instructor_id,
    sourceInstructorName: source.instructor_name,
    sourceTerm: source.term,
    sourceSessionCode: source.session_code,
    copiedAt,
    copyRecordId: 0,
  }

  const copyRows = await sql`
    INSERT INTO syllabus_exchange_copies (
      source_syllabus_id,
      destination_syllabus_id,
      source_course_id,
      destination_course_id,
      source_instructor_id,
      destination_instructor_id,
      attribution
    ) VALUES (
      ${source.id},
      ${destinationSyllabusId},
      ${source.course_id},
      ${params.destinationCourseId},
      ${source.instructor_id},
      ${params.destinationInstructorId},
      ${JSON.stringify({ ...attribution, copyRecordId: 0 })}::jsonb
    )
    RETURNING id
  `
  const copyRecordId = Number((copyRows[0] as { id: number }).id)
  attribution.copyRecordId = copyRecordId

  await sql`
    UPDATE course_syllabi
    SET template_provenance = ${JSON.stringify(attribution)}::jsonb
    WHERE id = ${destinationSyllabusId}
  `

  await sql`
    UPDATE syllabus_exchange_copies
    SET attribution = ${JSON.stringify(attribution)}::jsonb
    WHERE id = ${copyRecordId}
  `

  await sql`
    INSERT INTO syllabus_exchange_access_log (
      source_syllabus_id,
      destination_course_id,
      destination_syllabus_id,
      requester_instructor_id,
      source_instructor_id,
      copy_id,
      event_type,
      note
    ) VALUES (
      ${source.id},
      ${params.destinationCourseId},
      ${destinationSyllabusId},
      ${params.destinationInstructorId},
      ${source.instructor_id},
      ${copyRecordId},
      'apply_template',
      ${`Applied template from ${source.course_code}`}
    )
  `

  const syllabus = await getSyllabusByCourseId(params.destinationCourseId, destinationSessionId)
  if (!syllabus) throw new Error("Failed to load updated syllabus.")
  return syllabus
}
