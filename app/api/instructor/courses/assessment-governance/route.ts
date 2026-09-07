import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ASSESSMENT_PRIVILEGE_SOURCES,
  ensureAssessmentGovernanceColumns,
  parseAssessmentPrivilegeSource,
  type AssessmentPrivilegeSource,
} from "@/lib/assessment-privilege-governance"
import {
  logAssessmentPrivilegeSourceChange,
  logCoursePolicyNoticeChange,
} from "@/lib/course-assessment-audit"

export const dynamic = "force-dynamic"

async function countCourseStudents(courseId: number): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM students
    WHERE course_id = ${courseId}
      AND deleted_at IS NULL
  `
  return Number(rows[0]?.cnt) || 0
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureAssessmentGovernanceColumns()

    const rows = await sql`
      SELECT assessment_privilege_source, show_course_policy_notice, course_code, course_title
      FROM courses
      WHERE id = ${scope.course.id}
      LIMIT 1
    `
    const row = rows[0] as {
      assessment_privilege_source?: string
      show_course_policy_notice?: boolean
      course_code?: string
      course_title?: string
    } | undefined

    const studentsImpacted = await countCourseStudents(scope.course.id)

    return NextResponse.json({
      assessment_privilege_source: parseAssessmentPrivilegeSource(row?.assessment_privilege_source),
      show_course_policy_notice: row?.show_course_policy_notice !== false,
      course_label: `${row?.course_code ?? scope.course.course_code} — ${row?.course_title ?? scope.course.course_title}`,
      students_impacted: studentsImpacted,
    })
  } catch (error) {
    console.error("[assessment-governance GET]", error)
    return NextResponse.json({ error: "Failed to load assessment governance" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureAssessmentGovernanceColumns()

    const body = await request.json()
    const existing = await sql`
      SELECT assessment_privilege_source, show_course_policy_notice
      FROM courses
      WHERE id = ${scope.course.id}
      LIMIT 1
    `
    const prev = existing[0] as {
      assessment_privilege_source?: string
      show_course_policy_notice?: boolean
    } | undefined

    const oldSource = parseAssessmentPrivilegeSource(prev?.assessment_privilege_source)
    const oldNotice = prev?.show_course_policy_notice !== false

    let newSource = oldSource
    if (body.assessment_privilege_source != null) {
      const raw = String(body.assessment_privilege_source).trim().toLowerCase()
      if (!ASSESSMENT_PRIVILEGE_SOURCES.includes(raw as AssessmentPrivilegeSource)) {
        return NextResponse.json({ error: "Invalid assessment_privilege_source" }, { status: 400 })
      }
      newSource = raw as AssessmentPrivilegeSource
    }

    let newNotice = oldNotice
    if (body.show_course_policy_notice != null) {
      newNotice = Boolean(body.show_course_policy_notice)
    }

    await sql`
      UPDATE courses
      SET assessment_privilege_source = ${newSource},
          show_course_policy_notice = ${newNotice},
          updated_at = NOW()
      WHERE id = ${scope.course.id}
    `

    if (newSource !== oldSource) {
      await logAssessmentPrivilegeSourceChange({
        actorId: scope.instructorId,
        courseId: scope.course.id,
        oldSource,
        newSource,
      })
    }
    if (newNotice !== oldNotice) {
      await logCoursePolicyNoticeChange({
        actorId: scope.instructorId,
        courseId: scope.course.id,
        oldVisible: oldNotice,
        newVisible: newNotice,
      })
    }

    const studentsImpacted = await countCourseStudents(scope.course.id)

    return NextResponse.json({
      success: true,
      assessment_privilege_source: newSource,
      show_course_policy_notice: newNotice,
      students_impacted: studentsImpacted,
    })
  } catch (error) {
    console.error("[assessment-governance PATCH]", error)
    return NextResponse.json({ error: "Failed to save assessment governance" }, { status: 500 })
  }
}
