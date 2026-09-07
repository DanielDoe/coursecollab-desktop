import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import {
  assessmentPrivilegeSourceLabel,
  ensureAssessmentGovernanceColumns,
  parseAssessmentPrivilegeSource,
} from "@/lib/assessment-privilege-governance"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const sid = auth.studentDbId

    const studentRows = await sql`
      SELECT course_id FROM students WHERE id = ${sid} LIMIT 1
    `
    const courseId = Number(studentRows[0]?.course_id)
    if (!courseId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    await ensureAssessmentGovernanceColumns()

    const courseRows = await sql`
      SELECT assessment_privilege_source, show_course_policy_notice, course_code, course_title
      FROM courses
      WHERE id = ${courseId}
      LIMIT 1
    `
    const row = courseRows[0] as {
      assessment_privilege_source?: string
      show_course_policy_notice?: boolean
      course_code?: string
      course_title?: string
    } | undefined

    const source = parseAssessmentPrivilegeSource(row?.assessment_privilege_source)

    return NextResponse.json({
      course_id: courseId,
      course_code: row?.course_code ?? null,
      course_title: row?.course_title ?? null,
      assessment_privilege_source: source,
      source_label: assessmentPrivilegeSourceLabel(source),
      show_course_policy_notice: row?.show_course_policy_notice !== false,
    })
  } catch (error) {
    console.error("[student course-assessment-governance GET]", error)
    return NextResponse.json({ error: "Failed to load course policies" }, { status: 500 })
  }
}
