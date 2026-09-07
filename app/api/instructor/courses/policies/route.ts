import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  mergeAttendancePolicy,
  mergeProjectPolicy,
  mergeRewardsPolicy,
  parseAttendancePolicy,
  parseProjectPolicy,
  parseRewardsPolicy,
} from "@/lib/course-policy-settings"
import {
  mergePlaygroundPolicy,
  parsePlaygroundPolicy,
} from "@/lib/playground-policy-settings"
import { ensurePlaygroundPolicyColumn } from "@/lib/playground-policy-settings.server"
import {
  mergeAssessmentPolicy,
  parseAssessmentPolicy,
} from "@/lib/assessment-policy-settings"
import { ensureAssessmentPolicyColumn } from "@/lib/assessment-policy-settings.server"
import {
  mergePracticeHubPolicy,
  parsePracticeHubPolicy,
} from "@/lib/practice-hub-policy-settings"
import { ensurePracticeHubPolicyColumn } from "@/lib/practice-hub-policy-settings.server"

export const dynamic = "force-dynamic"

async function ensureCoursePoliciesRow(courseId: number, instructorId: number) {
  await sql`
    INSERT INTO course_policies (course_id, updated_by)
    VALUES (${courseId}, ${instructorId})
    ON CONFLICT (course_id) DO NOTHING
  `
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCoursePoliciesRow(scope.course.id, scope.instructorId)
    await ensurePlaygroundPolicyColumn()
    await ensureAssessmentPolicyColumn()
    await ensurePracticeHubPolicyColumn()

    const rows = await sql`
      SELECT attendance_policy, rewards_policy, project_policy, playground_policy, assessment_policy, practice_hub_policy, updated_at
      FROM course_policies
      WHERE course_id = ${scope.course.id}
      LIMIT 1
    `
    const row = rows[0] as {
      attendance_policy?: unknown
      rewards_policy?: unknown
      project_policy?: unknown
      playground_policy?: unknown
      assessment_policy?: unknown
      practice_hub_policy?: unknown
      updated_at?: string
    } | undefined

    return NextResponse.json({
      attendance_policy: parseAttendancePolicy(row?.attendance_policy),
      rewards_policy: parseRewardsPolicy(row?.rewards_policy),
      project_policy: parseProjectPolicy(row?.project_policy),
      playground_policy: parsePlaygroundPolicy(row?.playground_policy),
      assessment_policy: parseAssessmentPolicy(row?.assessment_policy),
      practice_hub_policy: parsePracticeHubPolicy(row?.practice_hub_policy),
      updated_at: row?.updated_at ?? null,
    })
  } catch (error) {
    console.error("[course-policies GET]", error)
    return NextResponse.json({ error: "Failed to load course policies" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    await ensureCoursePoliciesRow(scope.course.id, scope.instructorId)
    await ensurePlaygroundPolicyColumn()
    await ensureAssessmentPolicyColumn()
    await ensurePracticeHubPolicyColumn()

    const existing = await sql`
      SELECT attendance_policy, rewards_policy, project_policy, playground_policy, assessment_policy, practice_hub_policy
      FROM course_policies
      WHERE course_id = ${scope.course.id}
      LIMIT 1
    `
    const row = existing[0] as {
      attendance_policy?: unknown
      rewards_policy?: unknown
      project_policy?: unknown
      playground_policy?: unknown
      assessment_policy?: unknown
      practice_hub_policy?: unknown
    } | undefined

    const attendancePolicy =
      body.attendance_policy != null
        ? mergeAttendancePolicy(row?.attendance_policy, body.attendance_policy)
        : parseAttendancePolicy(row?.attendance_policy)
    const rewardsPolicy =
      body.rewards_policy != null
        ? mergeRewardsPolicy(row?.rewards_policy, body.rewards_policy)
        : parseRewardsPolicy(row?.rewards_policy)
    const projectPolicy =
      body.project_policy != null
        ? mergeProjectPolicy(row?.project_policy, body.project_policy)
        : parseProjectPolicy(row?.project_policy)
    const playgroundPolicy =
      body.playground_policy != null
        ? mergePlaygroundPolicy(row?.playground_policy, body.playground_policy)
        : parsePlaygroundPolicy(row?.playground_policy)
    const assessmentPolicy =
      body.assessment_policy != null
        ? mergeAssessmentPolicy(row?.assessment_policy, body.assessment_policy)
        : parseAssessmentPolicy(row?.assessment_policy)
    const practiceHubPolicy =
      body.practice_hub_policy != null
        ? mergePracticeHubPolicy(row?.practice_hub_policy, body.practice_hub_policy)
        : parsePracticeHubPolicy(row?.practice_hub_policy)

    await sql`
      UPDATE course_policies
      SET attendance_policy = ${JSON.stringify(attendancePolicy)}::jsonb,
          rewards_policy = ${JSON.stringify(rewardsPolicy)}::jsonb,
          project_policy = ${JSON.stringify(projectPolicy)}::jsonb,
          playground_policy = ${JSON.stringify(playgroundPolicy)}::jsonb,
          assessment_policy = ${JSON.stringify(assessmentPolicy)}::jsonb,
          practice_hub_policy = ${JSON.stringify(practiceHubPolicy)}::jsonb,
          updated_by = ${scope.instructorId},
          updated_at = NOW()
      WHERE course_id = ${scope.course.id}
    `

    return NextResponse.json({
      success: true,
      attendance_policy: attendancePolicy,
      rewards_policy: rewardsPolicy,
      project_policy: projectPolicy,
      playground_policy: playgroundPolicy,
      assessment_policy: assessmentPolicy,
      practice_hub_policy: practiceHubPolicy,
    })
  } catch (error) {
    console.error("[course-policies PATCH]", error)
    return NextResponse.json({ error: "Failed to save course policies" }, { status: 500 })
  }
}
