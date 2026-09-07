import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  DEFAULT_PROJECT_POLICY,
  parseProjectPolicy,
  type ProjectPolicy,
} from "@/lib/course-policy-settings"

export async function loadProjectPolicyForCourse(
  courseId: number | null | undefined,
): Promise<ProjectPolicy> {
  if (courseId == null || !Number.isFinite(Number(courseId))) {
    return { ...DEFAULT_PROJECT_POLICY }
  }
  try {
    const rows = await sql`
      SELECT project_policy
      FROM course_policies
      WHERE course_id = ${Number(courseId)}
      LIMIT 1
    `
    return parseProjectPolicy((rows[0] as { project_policy?: unknown } | undefined)?.project_policy)
  } catch {
    return { ...DEFAULT_PROJECT_POLICY }
  }
}

export async function assertStudentSelfFormAllowed(
  courseId: number | null | undefined,
  isInstructor: boolean,
): Promise<{ ok: true; policy: ProjectPolicy } | { ok: false; response: NextResponse }> {
  const policy = await loadProjectPolicyForCourse(courseId)
  if (!isInstructor && !policy.allow_self_form_groups) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This course does not allow students to form or join groups on their own." },
        { status: 403 },
      ),
    }
  }
  return { ok: true, policy }
}

export async function assertGroupSizeWithinPolicy(
  courseId: number | null | undefined,
  nextMemberCount: number,
): Promise<{ ok: true; policy: ProjectPolicy } | { ok: false; response: NextResponse }> {
  const policy = await loadProjectPolicyForCourse(courseId)
  if (nextMemberCount > policy.max_team_size) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Team size cannot exceed ${policy.max_team_size} members for this course.` },
        { status: 403 },
      ),
    }
  }
  return { ok: true, policy }
}

export async function assertGroupSizeForProject(
  courseId: number | null | undefined,
  memberCount: number,
): Promise<{ ok: true; policy: ProjectPolicy } | { ok: false; response: NextResponse }> {
  const policy = await loadProjectPolicyForCourse(courseId)
  if (memberCount < policy.min_team_size) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Projects require at least ${policy.min_team_size} team members.` },
        { status: 403 },
      ),
    }
  }
  if (memberCount > policy.max_team_size) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Projects cannot exceed ${policy.max_team_size} team members.` },
        { status: 403 },
      ),
    }
  }
  return { ok: true, policy }
}
