import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import {
  assessmentPrivilegeSourceLabel,
  courseAssessmentPerksSummary,
  ensureAssessmentGovernanceColumns,
  parseAssessmentPrivilegeSource,
} from "@/lib/assessment-privilege-governance"
import { parseAssessmentPolicy } from "@/lib/assessment-policy-settings"
import { ensureAssessmentPolicyColumn } from "@/lib/assessment-policy-settings.server"
import {
  parseAttendancePolicy,
  parseProjectPolicy,
  parseRewardsPolicy,
} from "@/lib/course-policy-settings"
import { parsePlaygroundPolicy } from "@/lib/playground-policy-settings"
import { ensurePlaygroundPolicyColumn } from "@/lib/playground-policy-settings.server"
import { parsePracticeHubPolicy } from "@/lib/practice-hub-policy-settings"
import { ensurePracticeHubPolicyColumn } from "@/lib/practice-hub-policy-settings.server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentId = String(auth.studentDbId)
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 401 })
    }

    const sid = parseInt(studentId, 10)
    if (!Number.isFinite(sid)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
    }

    const studentRows = await sql`
      SELECT course_id FROM students WHERE id = ${sid} LIMIT 1
    `
    const courseId = Number(studentRows[0]?.course_id)
    if (!courseId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    await ensureAssessmentGovernanceColumns()
    await ensurePlaygroundPolicyColumn()
    await ensureAssessmentPolicyColumn()
    await ensurePracticeHubPolicyColumn()

    const rows = await sql`
      SELECT
        c.assessment_privilege_source,
        c.show_course_policy_notice,
        c.course_code,
        c.course_title,
        cp.attendance_policy,
        cp.rewards_policy,
        cp.project_policy,
        cp.playground_policy,
        cp.assessment_policy,
        cp.practice_hub_policy,
        cp.updated_at
      FROM courses c
      LEFT JOIN course_policies cp ON cp.course_id = c.id
      WHERE c.id = ${courseId}
      LIMIT 1
    `

    const row = rows[0] as {
      assessment_privilege_source?: string
      show_course_policy_notice?: boolean
      course_code?: string
      course_title?: string
      attendance_policy?: unknown
      rewards_policy?: unknown
      project_policy?: unknown
      playground_policy?: unknown
      assessment_policy?: unknown
      practice_hub_policy?: unknown
      updated_at?: string | null
    } | undefined

    if (!row) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const source = parseAssessmentPrivilegeSource(row.assessment_privilege_source)
    const perks = courseAssessmentPerksSummary(source)

    return NextResponse.json({
      course_id: courseId,
      course_code: row.course_code ?? null,
      course_title: row.course_title ?? null,
      assessment_privilege_source: source,
      source_label: assessmentPrivilegeSourceLabel(source),
      show_course_policy_notice: row.show_course_policy_notice !== false,
      perks,
      attendance_policy: parseAttendancePolicy(row.attendance_policy),
      rewards_policy: parseRewardsPolicy(row.rewards_policy),
      project_policy: parseProjectPolicy(row.project_policy),
      playground_policy: parsePlaygroundPolicy(row.playground_policy),
      practice_hub_policy: parsePracticeHubPolicy(row.practice_hub_policy),
      assessment_policy: parseAssessmentPolicy(row.assessment_policy),
      updated_at: row.updated_at ?? null,
    })
  } catch (error) {
    console.error("[student course-policies GET]", error)
    return NextResponse.json({ error: "Failed to load course policies" }, { status: 500 })
  }
}
