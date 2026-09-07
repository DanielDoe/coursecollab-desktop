import { sql } from "@/lib/db"
import { formatAcademicTermLabel } from "@/lib/active-academic-term"
import {
  courseUsesLabSections,
  defaultSessionCodeForCourse,
} from "@/lib/course-section-model"
import { invalidateSessionCatalogCache } from "@/lib/session-catalog"

export type TermCourseRow = {
  id: number
  course_id: number
  course_code: string
  course_title: string
  semester: string | null
  uses_sections: boolean
  section_count: number
  student_count: number
}

export async function listTermCourses(academicTermId: number): Promise<TermCourseRow[]> {
  const rows = await sql`
    SELECT
      atc.id,
      c.id AS course_id,
      c.course_code,
      c.course_title,
      c.semester,
      COUNT(DISTINCT s.id) FILTER (
        WHERE s.id IS NOT NULL AND TRIM(UPPER(s.code)) <> 'BETA'
      )::int AS section_count,
      COUNT(DISTINCT st.id)::int AS student_count
    FROM academic_term_courses atc
    INNER JOIN courses c ON c.id = atc.course_id
    LEFT JOIN sessions s ON s.course_id = c.id AND s.academic_term_id = atc.academic_term_id
    LEFT JOIN students st ON st.session_id = s.id
    WHERE atc.academic_term_id = ${academicTermId}
    GROUP BY atc.id, c.id, c.course_code, c.course_title, c.semester
    ORDER BY c.course_title ASC, c.id ASC
  `

  return (rows as Omit<TermCourseRow, "uses_sections">[]).map((r) => {
    const uses_sections = courseUsesLabSections(r.course_code)
    return {
      ...r,
      uses_sections,
      section_count: uses_sections ? Number(r.section_count) || 0 : 0,
    }
  })
}

/** Ensure a roster session exists for section-less courses (e.g. ECE2202). */
export async function ensureDefaultSessionForTermCourse(
  courseId: number,
  academicTermId: number,
): Promise<void> {
  const courseRows = await sql`
    SELECT course_code FROM courses WHERE id = ${courseId} LIMIT 1
  `
  if (!courseRows.length) return
  const courseCode = String((courseRows[0] as { course_code: string }).course_code)
  if (courseUsesLabSections(courseCode)) return

  const defaultCode = defaultSessionCodeForCourse(courseCode)
  if (!defaultCode) return

  const existing = await sql`
    SELECT id FROM sessions
    WHERE course_id = ${courseId}
      AND academic_term_id = ${academicTermId}
      AND TRIM(UPPER(code)) = TRIM(UPPER(${defaultCode}))
    LIMIT 1
  `
  if (existing.length === 0) {
    await sql`
      INSERT INTO sessions (code, description, academic_term_id, course_id)
      VALUES (${defaultCode}, ${courseCode}, ${academicTermId}, ${courseId})
    `
    invalidateSessionCatalogCache()
  }
}

export async function addCourseToTerm(
  academicTermId: number,
  courseId: number,
): Promise<TermCourseRow | null> {
  const termRows = await sql`
    SELECT year, term FROM academic_terms WHERE id = ${academicTermId} LIMIT 1
  `
  if (!termRows.length) return null

  const term = termRows[0] as { year: number; term: string }
  const label = formatAcademicTermLabel(term.year, term.term)

  await sql`
    INSERT INTO academic_term_courses (academic_term_id, course_id)
    VALUES (${academicTermId}, ${courseId})
    ON CONFLICT (academic_term_id, course_id) DO NOTHING
  `

  await sql`
    UPDATE courses
    SET semester = ${label}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${courseId}
  `

  await ensureDefaultSessionForTermCourse(courseId, academicTermId)

  const list = await listTermCourses(academicTermId)
  return list.find((c) => c.course_id === courseId) ?? null
}

export async function removeCourseFromTerm(
  academicTermId: number,
  courseId: number,
): Promise<boolean> {
  const enrolled = await sql`
    SELECT 1
    FROM students st
    INNER JOIN sessions s ON s.id = st.session_id
    WHERE s.course_id = ${courseId}
      AND s.academic_term_id = ${academicTermId}
    LIMIT 1
  `
  if (enrolled.length > 0) {
    throw new Error("Cannot remove a course that still has enrolled students in this term.")
  }

  await sql`
    DELETE FROM sessions
    WHERE course_id = ${courseId}
      AND academic_term_id = ${academicTermId}
      AND TRIM(UPPER(code)) <> 'BETA'
  `

  const result = await sql`
    DELETE FROM academic_term_courses
    WHERE academic_term_id = ${academicTermId} AND course_id = ${courseId}
    RETURNING id
  `
  invalidateSessionCatalogCache()
  return result.length > 0
}

export async function isCourseOfferedInTerm(
  courseId: number,
  academicTermId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM academic_term_courses
    WHERE course_id = ${courseId} AND academic_term_id = ${academicTermId}
    LIMIT 1
  `
  return rows.length > 0
}
