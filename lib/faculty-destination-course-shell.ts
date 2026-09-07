import { sql, asSqlRows } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { createInstructorCourse } from "@/lib/create-instructor-course"
import { provisionFacultyInstructorCourseAccess } from "@/lib/provision-faculty-course-access"
import {
  deriveDestinationShellCode,
  deriveDestinationShellTitle,
  normalizeShellCourseCode,
} from "@/lib/faculty-destination-course-shell-shared"

export {
  deriveDestinationShellCode,
  deriveDestinationShellTitle,
  deriveDestinationShellSuffix,
  normalizeShellCourseCode,
} from "@/lib/faculty-destination-course-shell-shared"

/** Reuse or create a dedicated owned shell — never staff-assign a global/source course. */
export async function provisionFacultyDestinationShell(
  instructorId: number,
  baseCourseCode: string,
  options?: {
    baseTitle?: string | null
    institution?: string | null
    university?: string | null
  },
): Promise<{ courseId: number; courseCode: string; created: boolean }> {
  const institution = options?.institution ?? null
  const shellCode = deriveDestinationShellCode(baseCourseCode, institution)
  const normalizedBase = normalizeShellCourseCode(baseCourseCode)

  const existing = asSqlRows<{ id: number; course_code: string }>(await sql`
    SELECT id, course_code
    FROM courses
    WHERE instructor_id = ${instructorId}
      AND is_active = true
      AND (
        REPLACE(UPPER(TRIM(course_code)), ' ', '') = ${shellCode}
        OR REPLACE(UPPER(TRIM(course_code)), ' ', '') = ${normalizedBase}
      )
    ORDER BY
      CASE WHEN REPLACE(UPPER(TRIM(course_code)), ' ', '') = ${shellCode} THEN 0 ELSE 1 END,
      id ASC
    LIMIT 1
  `)

  if (existing.length > 0) {
    const courseId = Number(existing[0].id)
    await provisionFacultyInstructorCourseAccess(instructorId, courseId, null)
    return { courseId, courseCode: String(existing[0].course_code), created: false }
  }

  const baseTitle =
    options?.baseTitle?.trim() ||
    baseCourseCode.replace(/([A-Z])([0-9])/g, "$1 $2").trim() ||
    baseCourseCode

  const activeTerm = await getActiveAcademicTerm()
  const created = await createInstructorCourse({
    instructorId,
    courseCode: shellCode,
    courseTitle: deriveDestinationShellTitle(baseTitle, institution),
    university: options?.university ?? institution,
    academicTermId: activeTerm?.id ?? null,
  })

  return { courseId: created.id, courseCode: created.course_code, created: true }
}

/** Prefer owned destination shell; provision when missing. Never reuse global/source courses. */
export async function resolveExchangeDestinationCourseId(
  instructorId: number,
  sourceCourseCode: string,
  institution: string | null | undefined,
  preferredCourseId?: number | null,
  options?: { baseTitle?: string | null; university?: string | null },
): Promise<number> {
  const shellCode = deriveDestinationShellCode(sourceCourseCode, institution)
  const normalizedShell = normalizeShellCourseCode(shellCode)

  if (preferredCourseId != null && Number.isFinite(Number(preferredCourseId))) {
    const selected = asSqlRows<{ id: number; course_code: string }>(await sql`
      SELECT id, course_code
      FROM courses
      WHERE id = ${Number(preferredCourseId)}
        AND instructor_id = ${instructorId}
        AND is_active = true
      LIMIT 1
    `)
    if (selected.length > 0) {
      const selectedNorm = normalizeShellCourseCode(String(selected[0].course_code))
      if (selectedNorm === normalizedShell) {
        return Number(selected[0].id)
      }
      const shellMatch = asSqlRows<{ id: number }>(await sql`
        SELECT id FROM courses
        WHERE instructor_id = ${instructorId}
          AND is_active = true
          AND REPLACE(UPPER(TRIM(course_code)), ' ', '') = ${normalizedShell}
        ORDER BY id ASC
        LIMIT 1
      `)
      if (shellMatch.length > 0) {
        await provisionFacultyInstructorCourseAccess(instructorId, Number(shellMatch[0].id), null)
        return Number(shellMatch[0].id)
      }
      return Number(selected[0].id)
    }
  }

  const provisioned = await provisionFacultyDestinationShell(instructorId, sourceCourseCode, {
    institution,
    baseTitle: options?.baseTitle ?? sourceCourseCode,
    university: options?.university ?? institution,
  })
  return provisioned.courseId
}
