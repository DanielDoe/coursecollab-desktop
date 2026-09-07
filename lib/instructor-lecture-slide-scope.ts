import { sql } from "@/lib/db"
import { buildLectureInstructorCourseScopeSqlFragment } from "@/lib/instructor-default-courses"

/**
 * True if this lecture is visible under the instructor’s selected course (same rules as `/api/instructor/lectures`).
 */
export async function isLectureInSelectedCourseScope(
  lectureId: number,
  courseId: number,
  instructorId: number,
  scopeCourseCode: string | null | undefined,
): Promise<boolean> {
  const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
    courseId,
    instructorId,
    scopeCourseCode,
  )
  const rows = await sql`
    SELECT 1 AS ok
    FROM lectures l
    WHERE l.id = ${lectureId}
      AND l.deleted_at IS NULL
      AND (${scopeWhere})
    LIMIT 1
  `
  return rows.length > 0
}

export async function isSlideInSelectedCourseScope(
  slideId: number,
  courseId: number,
  instructorId: number,
  scopeCourseCode: string | null | undefined,
): Promise<boolean> {
  const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
    courseId,
    instructorId,
    scopeCourseCode,
  )
  const rows = await sql`
    SELECT 1 AS ok
    FROM lecture_slides ls
    INNER JOIN lectures l ON l.id = ls.lecture_id
    WHERE ls.id = ${slideId}
      AND l.deleted_at IS NULL
      AND (${scopeWhere})
    LIMIT 1
  `
  return rows.length > 0
}
