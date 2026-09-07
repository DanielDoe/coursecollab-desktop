import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import {
  mergeAttendancePolicy,
  mergeProjectPolicy,
  mergeRewardsPolicy,
  type AttendancePolicy,
  type ProjectPolicy,
  type RewardsPolicy,
} from "@/lib/course-policy-settings"
import { mergeCourseGradingPolicy } from "@/lib/course-grading-policy-settings"
import { parseUploadPointsMultiplier } from "@/lib/multi-part-grading-policy"
import { parseAssessmentPerksGraceDays } from "@/lib/assessment-perks-expiry"
import {
  mergePlaygroundPolicy,
  type PlaygroundPolicy,
} from "@/lib/playground-policy-settings"
import { ensurePlaygroundPolicyColumn } from "@/lib/playground-policy-settings.server"
import { mergeAssessmentPolicy, type AssessmentPolicy } from "@/lib/assessment-policy-settings"
import { ensureAssessmentPolicyColumn } from "@/lib/assessment-policy-settings.server"
import {
  mergePracticeHubPolicy,
  type PracticeHubPolicy,
} from "@/lib/practice-hub-policy-settings"
import { ensurePracticeHubPolicyColumn } from "@/lib/practice-hub-policy-settings.server"

export async function ensureCoursePoliciesRow(
  courseId: number,
  instructorId: number,
): Promise<void> {
  await sql`
    INSERT INTO course_policies (course_id, updated_by)
    VALUES (${courseId}, ${instructorId})
    ON CONFLICT (course_id) DO NOTHING
  `
}

export async function updateCourseGradingPolicy(params: {
  instructorId: number
  courseId: number
  patch: Record<string, unknown>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update grading policy for this course.")

  const patch: Record<string, number | boolean> = {}
  if (params.patch.multi_part_upload_multiplier !== undefined) {
    patch.multi_part_upload_multiplier = parseUploadPointsMultiplier(
      params.patch.multi_part_upload_multiplier,
    )
  }
  if (params.patch.assessment_perks_grace_days_after_deadline !== undefined) {
    patch.assessment_perks_grace_days_after_deadline = parseAssessmentPerksGraceDays(
      params.patch.assessment_perks_grace_days_after_deadline,
    )
  }
  if (params.patch.auto_finalize_perfect_scores !== undefined) {
    patch.auto_finalize_perfect_scores = Boolean(params.patch.auto_finalize_perfect_scores)
  }

  if (Object.keys(patch).length === 0) {
    throw new Error(
      "Provide multi_part_upload_multiplier, assessment_perks_grace_days_after_deadline, and/or auto_finalize_perfect_scores.",
    )
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)

  const existing = (await sql`
    SELECT grading_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { grading_policy?: unknown }[]

  const merged = mergeCourseGradingPolicy(existing[0]?.grading_policy, patch)

  await sql`
    UPDATE course_policies
    SET grading_policy = ${JSON.stringify(merged)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/grading-policies" }
}

export async function updateCourseAttendancePolicy(params: {
  instructorId: number
  courseId: number
  patch: Partial<AttendancePolicy>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update attendance policy for this course.")

  if (!params.patch || typeof params.patch !== "object" || Object.keys(params.patch).length === 0) {
    throw new Error("attendance_policy patch is required.")
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)

  const existing = (await sql`
    SELECT attendance_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { attendance_policy?: unknown }[]

  const attendancePolicy = mergeAttendancePolicy(existing[0]?.attendance_policy, params.patch)

  await sql`
    UPDATE course_policies
    SET attendance_policy = ${JSON.stringify(attendancePolicy)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/attendance-policies" }
}

export async function updateCourseRewardsPolicy(params: {
  instructorId: number
  courseId: number
  patch: Partial<RewardsPolicy>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update rewards policy for this course.")

  if (!params.patch || typeof params.patch !== "object" || Object.keys(params.patch).length === 0) {
    throw new Error("rewards_policy patch is required.")
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)

  const existing = (await sql`
    SELECT rewards_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { rewards_policy?: unknown }[]

  const rewardsPolicy = mergeRewardsPolicy(existing[0]?.rewards_policy, params.patch)

  await sql`
    UPDATE course_policies
    SET rewards_policy = ${JSON.stringify(rewardsPolicy)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/classroom-points-rules" }
}

export async function updateCourseProjectPolicy(params: {
  instructorId: number
  courseId: number
  patch: Partial<ProjectPolicy>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update project policy for this course.")

  if (!params.patch || typeof params.patch !== "object" || Object.keys(params.patch).length === 0) {
    throw new Error("project_policy patch is required.")
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)

  const existing = (await sql`
    SELECT project_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { project_policy?: unknown }[]

  const projectPolicy = mergeProjectPolicy(existing[0]?.project_policy, params.patch)

  await sql`
    UPDATE course_policies
    SET project_policy = ${JSON.stringify(projectPolicy)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/team-project-policies" }
}

export async function updateCoursePlaygroundPolicy(params: {
  instructorId: number
  courseId: number
  patch: Partial<PlaygroundPolicy>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update playground policy for this course.")

  if (!params.patch || typeof params.patch !== "object" || Object.keys(params.patch).length === 0) {
    throw new Error("playground_policy patch is required.")
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)
  await ensurePlaygroundPolicyColumn()

  const existing = (await sql`
    SELECT playground_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { playground_policy?: unknown }[]

  const playgroundPolicy = mergePlaygroundPolicy(existing[0]?.playground_policy, params.patch)

  await sql`
    UPDATE course_policies
    SET playground_policy = ${JSON.stringify(playgroundPolicy)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/playground-rules" }
}

export async function updateCourseAssessmentPolicyDefaults(params: {
  instructorId: number
  courseId: number
  patch: Partial<AssessmentPolicy> | Record<string, unknown>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update assessment defaults for this course.")

  if (!params.patch || typeof params.patch !== "object" || Object.keys(params.patch).length === 0) {
    throw new Error("assessment_policy patch is required.")
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)
  await ensureAssessmentPolicyColumn()

  const existing = (await sql`
    SELECT assessment_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { assessment_policy?: unknown }[]

  const assessmentPolicy = mergeAssessmentPolicy(existing[0]?.assessment_policy, params.patch)

  await sql`
    UPDATE course_policies
    SET assessment_policy = ${JSON.stringify(assessmentPolicy)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/assessment-defaults" }
}

export async function updateCoursePracticeHubPolicy(params: {
  instructorId: number
  courseId: number
  patch: Partial<PracticeHubPolicy>
}): Promise<{ href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update practice hub policy for this course.")

  if (!params.patch || typeof params.patch !== "object" || Object.keys(params.patch).length === 0) {
    throw new Error("practice_hub_policy patch is required.")
  }

  await ensureCoursePoliciesRow(params.courseId, params.instructorId)
  await ensurePracticeHubPolicyColumn()

  const existing = (await sql`
    SELECT practice_hub_policy FROM course_policies WHERE course_id = ${params.courseId} LIMIT 1
  `) as { practice_hub_policy?: unknown }[]

  const practiceHubPolicy = mergePracticeHubPolicy(existing[0]?.practice_hub_policy, params.patch)

  await sql`
    UPDATE course_policies
    SET practice_hub_policy = ${JSON.stringify(practiceHubPolicy)}::jsonb,
        updated_by = ${params.instructorId},
        updated_at = NOW()
    WHERE course_id = ${params.courseId}
  `

  return { href: "/module/practice-rules" }
}

export function parseGradingPolicyPatch(args: Record<string, unknown>): Record<string, unknown> {
  const patch = args.patch != null && typeof args.patch === "object" && !Array.isArray(args.patch)
    ? (args.patch as Record<string, unknown>)
    : {}
  return {
    multi_part_upload_multiplier:
      patch.multi_part_upload_multiplier ?? args.multi_part_upload_multiplier ?? args.multiPartUploadMultiplier,
    assessment_perks_grace_days_after_deadline:
      patch.assessment_perks_grace_days_after_deadline ??
      args.assessment_perks_grace_days_after_deadline ??
      args.assessmentPerksGraceDaysAfterDeadline,
    auto_finalize_perfect_scores:
      patch.auto_finalize_perfect_scores ??
      args.auto_finalize_perfect_scores ??
      args.autoFinalizePerfectScores,
  }
}

export function parseAttendancePolicyPatch(args: Record<string, unknown>): Partial<AttendancePolicy> {
  const raw =
    args.attendance_policy != null && typeof args.attendance_policy === "object"
      ? (args.attendance_policy as Partial<AttendancePolicy>)
      : args.attendancePolicy != null && typeof args.attendancePolicy === "object"
        ? (args.attendancePolicy as Partial<AttendancePolicy>)
        : args.patch != null && typeof args.patch === "object" && !Array.isArray(args.patch)
          ? (args.patch as Partial<AttendancePolicy>)
          : {}
  return raw
}
