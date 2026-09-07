import { sql } from "@/lib/db"
import { formatAcademicTermLabel, getActiveAcademicTerm } from "@/lib/active-academic-term"
import { getSessionCatalogFromDb } from "@/lib/session-catalog"

export type EnrollmentCatalogSection = {
  id: number
  code: string
  description: string | null
}

export type EnrollmentCatalogCourse = {
  id: number
  courseCode: string
  courseTitle: string
  instructorName: string | null
  sections: EnrollmentCatalogSection[]
}

export async function getStudentEnrollmentCatalog(universityId: number): Promise<{
  activeTerm: { id: number; label: string } | null
  courses: EnrollmentCatalogCourse[]
}> {
  const uid = Math.trunc(Number(universityId))
  if (!Number.isFinite(uid) || uid <= 0) {
    return { activeTerm: null, courses: [] }
  }

  const activeTerm = await getActiveAcademicTerm()
  if (!activeTerm) {
    return { activeTerm: null, courses: [] }
  }

  const courseRows = (await sql`
    SELECT DISTINCT
      c.id,
      c.course_code,
      c.course_title,
      i.name AS instructor_name
    FROM courses c
    INNER JOIN academic_term_courses atc ON atc.course_id = c.id AND atc.academic_term_id = ${activeTerm.id}
    LEFT JOIN instructors i ON i.id = c.instructor_id
    WHERE c.is_active = true
      AND c.university_id = ${uid}
    ORDER BY c.course_title ASC, c.id ASC
  `) as Array<{
    id: number
    course_code: string
    course_title: string
    instructor_name: string | null
  }>

  const courses: EnrollmentCatalogCourse[] = []

  for (const row of courseRows) {
    const sessionEntries = await getSessionCatalogFromDb({
      courseId: row.id,
      academicTermId: activeTerm.id,
    })

    if (sessionEntries.length === 0) continue

    courses.push({
      id: Number(row.id),
      courseCode: String(row.course_code),
      courseTitle: String(row.course_title),
      instructorName: row.instructor_name ? String(row.instructor_name) : null,
      sections: sessionEntries.map((s) => ({
        id: Number(s.id),
        code: String(s.code),
        description: s.label?.trim() ? String(s.label) : null,
      })),
    })
  }

  return {
    activeTerm: {
      id: activeTerm.id,
      label: formatAcademicTermLabel(activeTerm.year, activeTerm.term),
    },
    courses,
  }
}
