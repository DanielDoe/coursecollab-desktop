import { sql } from "@/lib/db"
import {
  DEFAULT_PLAYGROUND_POLICY,
  parsePlaygroundPolicy,
  type PlaygroundPolicy,
} from "@/lib/playground-policy-settings"

export async function getPlaygroundPolicyForCourse(courseId: number | null): Promise<PlaygroundPolicy> {
  if (courseId == null || !Number.isFinite(courseId)) {
    return { ...DEFAULT_PLAYGROUND_POLICY, default_allowed_session_ids: [] }
  }

  try {
    const rows = await sql`
      SELECT playground_policy
      FROM course_policies
      WHERE course_id = ${courseId}
      LIMIT 1
    `
    return parsePlaygroundPolicy(rows[0]?.playground_policy)
  } catch {
    return { ...DEFAULT_PLAYGROUND_POLICY, default_allowed_session_ids: [] }
  }
}

export async function ensurePlaygroundPolicyColumn(): Promise<void> {
  await sql`ALTER TABLE course_policies ADD COLUMN IF NOT EXISTS playground_policy JSONB NOT NULL DEFAULT '{}'::jsonb`
}
