import { sql } from "@/lib/db"
import {
  DEFAULT_PRACTICE_HUB_POLICY,
  parsePracticeHubPolicy,
  type PracticeHubPolicy,
} from "@/lib/practice-hub-policy-settings"

export async function getPracticeHubPolicyForCourse(courseId: number | null): Promise<PracticeHubPolicy> {
  if (courseId == null || !Number.isFinite(courseId)) {
    return { ...DEFAULT_PRACTICE_HUB_POLICY }
  }

  try {
    await ensurePracticeHubPolicyColumn()
    const rows = await sql`
      SELECT practice_hub_policy
      FROM course_policies
      WHERE course_id = ${courseId}
      LIMIT 1
    `
    return parsePracticeHubPolicy(rows[0]?.practice_hub_policy)
  } catch {
    return { ...DEFAULT_PRACTICE_HUB_POLICY }
  }
}

export async function getPracticeSessionConfig(session: string | null): Promise<{
  daily_limit: number | null
  difficulty_distribution: Record<string, number> | null
} | null> {
  const key = session?.trim() || "ALL"
  try {
    const rows = await sql`
      SELECT daily_limit, difficulty_distribution
      FROM practice_session_configs
      WHERE session = ${key} OR session = 'ALL'
      ORDER BY CASE WHEN session = ${key} THEN 0 ELSE 1 END
      LIMIT 1
    `
    if (rows.length === 0) return null
    const row = rows[0] as { daily_limit?: number | null; difficulty_distribution?: unknown }
    let difficulty_distribution: Record<string, number> | null = null
    if (row.difficulty_distribution && typeof row.difficulty_distribution === "object") {
      difficulty_distribution = row.difficulty_distribution as Record<string, number>
    }
    return {
      daily_limit: row.daily_limit != null ? Number(row.daily_limit) : null,
      difficulty_distribution,
    }
  } catch {
    return null
  }
}

export async function ensurePracticeHubPolicyColumn(): Promise<void> {
  await sql`ALTER TABLE course_policies ADD COLUMN IF NOT EXISTS practice_hub_policy JSONB NOT NULL DEFAULT '{}'::jsonb`
}
