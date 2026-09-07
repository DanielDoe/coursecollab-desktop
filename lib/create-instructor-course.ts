import { sql, asSqlRows } from "@/lib/db"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { addCourseToTerm } from "@/lib/academic-term-courses"
import { mergeCourseModuleSettings } from "@/lib/course-module-settings"
import { provisionFacultyInstructorCourseAccess } from "@/lib/provision-faculty-course-access"
import { ensureAssessmentGovernanceColumns } from "@/lib/assessment-privilege-governance"

const DEFAULT_MODULE_SETTINGS_JSON =
  '{"codeBench":true,"aiTutor":true,"questionBank":true,"practiceHub":true,"announcements":true,"lectures":true,"attendance":true}' as const

export function normalizeCourseCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32)
}

export type CreatedInstructorCourse = {
  id: number
  course_code: string
  course_title: string
  university: string | null
  semester: string | null
  description: string | null
  instructor_id: number
  module_settings: ReturnType<typeof mergeCourseModuleSettings>
  academic_term_id: number | null
}

export async function createInstructorCourse(params: {
  instructorId: number
  courseCode: string
  courseTitle: string
  description?: string | null
  university?: string | null
  academicTermId?: number | null
}): Promise<CreatedInstructorCourse> {
  const instructorId = Math.trunc(params.instructorId)
  const courseCode = normalizeCourseCode(params.courseCode)
  const courseTitle = params.courseTitle.trim()

  if (!Number.isFinite(instructorId) || instructorId < 1) {
    throw new Error("Invalid instructor")
  }
  if (!courseCode || courseCode.length < 2) {
    throw new Error("Course code must be at least 2 characters")
  }
  if (!courseTitle) {
    throw new Error("Course title is required")
  }

  const dup = asSqlRows(await sql`
    SELECT id FROM courses
    WHERE instructor_id = ${instructorId}
      AND TRIM(UPPER(course_code)) = ${courseCode}
      AND COALESCE(is_active, true) = true
    LIMIT 1
  `)
  if (dup.length > 0) {
    throw new Error("You already have a course with this code")
  }

  await ensureAssessmentGovernanceColumns()

  let university = params.university?.trim() || null
  let universityId: number | null = null
  const instRows = asSqlRows<{ institution: string | null; university_id: number | null }>(await sql`
    SELECT institution, university_id FROM instructors WHERE id = ${instructorId} LIMIT 1
  `)
  const inst = instRows[0]
  if (inst?.university_id != null && Number.isFinite(Number(inst.university_id))) {
    universityId = Number(inst.university_id)
  }
  if (!university) {
    university = inst ? String(inst.institution ?? "").trim() || null : null
  }

  const inserted = asSqlRows<Record<string, unknown>>(await sql`
    INSERT INTO courses (
      course_code,
      course_title,
      instructor_id,
      description,
      university,
      university_id,
      is_active,
      module_settings,
      assessment_privilege_source,
      show_course_policy_notice
    )
    VALUES (
      ${courseCode},
      ${courseTitle},
      ${instructorId},
      ${params.description?.trim() || null},
      ${university},
      ${universityId},
      true,
      ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb,
      'instructor_only',
      true
    )
    RETURNING id, course_code, course_title, university, semester, description, instructor_id, module_settings
  `)

  const row = inserted[0]
  if (!row) {
    throw new Error("Failed to create course")
  }
  const courseId = Number(row.id)

  await provisionFacultyInstructorCourseAccess(instructorId, courseId, instructorId)

  let academicTermId = params.academicTermId ?? null
  if (academicTermId == null) {
    const active = await getActiveAcademicTerm()
    academicTermId = active?.id ?? null
  }

  let semester: string | null = row.semester != null ? String(row.semester) : null
  if (academicTermId != null) {
    const offering = await addCourseToTerm(academicTermId, courseId)
    if (offering) {
      semester = offering.semester
    }
  }

  return {
    id: courseId,
    course_code: String(row.course_code),
    course_title: String(row.course_title),
    university: row.university != null ? String(row.university) : null,
    semester,
    description: row.description != null ? String(row.description) : null,
    instructor_id: instructorId,
    module_settings: mergeCourseModuleSettings(row.module_settings),
    academic_term_id: academicTermId,
  }
}
