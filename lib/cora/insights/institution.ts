import { sql } from "@/lib/db"
import { ensureCoraInsightsSchema } from "@/lib/cora/insights/schema"
import { getInstitutionAskCoraInsights } from "@/lib/cora/assessment-policy-analytics"

/** Aggregated institution Cora Insights — no individual conversations. */
export async function loadInstitutionCoraInsights(institutionId: number) {
  await ensureCoraInsightsSchema().catch(() => undefined)
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [integrity, usage, categories, colleges] = await Promise.all([
    getInstitutionAskCoraInsights(institutionId),
    sql`
      SELECT
        COUNT(*)::int AS events,
        COUNT(DISTINCT e.user_id)::int AS users
      FROM cora_usage_events e
      WHERE e.user_role = 'student'
        AND e.institution_id = ${institutionId}
        AND e.created_at >= ${from}
    `.catch(() => [{ events: 0, users: 0 }]),
    sql`
      SELECT e.interaction_category AS category, COUNT(*)::int AS n
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      JOIN institution_members m ON m.user_type = 'student' AND m.user_id = s.id
      WHERE m.institution_id = ${institutionId}
        AND e.occurred_at >= ${from}
      GROUP BY 1
      ORDER BY n DESC
      LIMIT 10
    `.catch(() => []),
    sql`
      SELECT COALESCE(c.department, c.college, 'Unassigned') AS unit,
             COUNT(*)::int AS events,
             COUNT(DISTINCT e.user_id)::int AS users
      FROM cora_interaction_events e
      JOIN courses c ON c.id = e.course_id
      WHERE e.occurred_at >= ${from}
        AND c.institution_id = ${institutionId}
      GROUP BY 1
      ORDER BY events DESC
      LIMIT 12
    `.catch(() => []),
  ])
  const u = (usage as Array<Record<string, unknown>>)[0] ?? {}
  return {
    adoptionStudents: integrity.adoptionStudents || Number(u.users ?? 0),
    events: Number(u.events ?? 0),
    answerProtections: integrity.answerProtections,
    conceptualGuidance: integrity.conceptualGuidance,
    assistedSuccessRate: integrity.assistedSuccessRate,
    categories: (categories as Array<Record<string, unknown>>).map((r) => ({
      category: String(r.category),
      count: Number(r.n ?? 0),
    })),
    units: (colleges as Array<Record<string, unknown>>).map((r) => ({
      unit: String(r.unit),
      events: Number(r.events ?? 0),
      users: Number(r.users ?? 0),
    })),
  }
}
