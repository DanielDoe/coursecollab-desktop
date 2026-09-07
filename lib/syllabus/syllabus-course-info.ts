import { sql } from "@/lib/db"

export type SyllabusCourseInfo = {
  courseId: number
  courseCode: string | null
  courseTitle: string | null
  university: string | null
  semester: string | null
}

export async function getSyllabusCourseInfo(courseId: number): Promise<SyllabusCourseInfo | null> {
  const rows = await sql`
    SELECT id, course_code, course_title, university, semester
    FROM courses
    WHERE id = ${courseId}
    LIMIT 1
  `
  if (!rows.length) return null
  const row = rows[0] as {
    id: number
    course_code: string | null
    course_title: string | null
    university: string | null
    semester: string | null
  }
  return {
    courseId: row.id,
    courseCode: row.course_code ? String(row.course_code) : null,
    courseTitle: row.course_title ? String(row.course_title) : null,
    university: row.university ? String(row.university) : null,
    semester: row.semester ? String(row.semester) : null,
  }
}
