import { sql } from "@/lib/db"
import { getInstitutionAskCoraInsights } from "@/lib/cora/assessment-policy-analytics"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"
import { coraUsageAlerts } from "@/lib/institutions/cora-alerts"
import { prettyInsightLabel } from "@/lib/institutions/insights"
import { parsePgDateOnly } from "@/lib/institutions/metrics/scope"

export async function getInstitutionCoraModule(institutionId: number) {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null

  const [allowance, byWorkflow, byRole, weekly, topUsers] = await Promise.all([
    licenseId
      ? sql`SELECT included_credits, used_credits, reset_date FROM institution_cora_allowances WHERE license_id = ${licenseId} LIMIT 1`
      : Promise.resolve([]),
    sql`
      SELECT COALESCE(NULLIF(TRIM(workflow_type), ''), 'other') AS key,
        COUNT(*)::int AS workflows,
        COALESCE(SUM(credits), 0)::int AS credits
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
      GROUP BY 1 ORDER BY credits DESC LIMIT 12
    `,
    sql`
      SELECT COALESCE(NULLIF(TRIM(user_type), ''), 'unknown') AS role,
        COUNT(*)::int AS workflows,
        COALESCE(SUM(credits), 0)::int AS credits
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
      GROUP BY 1
    `,
    sql`
      SELECT date_trunc('week', created_at)::date AS week, COALESCE(SUM(credits), 0)::int AS credits
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId} AND created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `,
    sql`
      SELECT u.user_type, u.user_id,
        COUNT(*)::int AS workflows,
        COALESCE(SUM(u.credits), 0)::int AS credits,
        COALESCE(i.name, s.full_name, m.email, 'User') AS display_name
      FROM institution_cora_usage u
      LEFT JOIN instructors i ON u.user_type = 'instructor' AND i.id = u.user_id
      LEFT JOIN students s ON u.user_type = 'student' AND s.id = u.user_id
      LEFT JOIN institution_members m ON m.institution_id = ${institutionId}
        AND m.user_type = u.user_type AND m.user_id = u.user_id
      WHERE u.institution_id = ${institutionId}
      GROUP BY u.user_type, u.user_id, i.name, s.full_name, m.email
      ORDER BY credits DESC
      LIMIT 10
    `,
  ])

  const included = Number(allowance[0]?.included_credits ?? license?.included_cora_credits ?? 0)
  const used = Number(allowance[0]?.used_credits ?? 0)
  const remaining = Math.max(0, included - used)
  const pct = included > 0 ? Math.round((used / included) * 1000) / 10 : null
  const uniqueUsers = await sql`
    SELECT COUNT(DISTINCT user_id)::int AS n FROM institution_cora_usage
    WHERE institution_id = ${institutionId}
  `
  const workflowTotal = byWorkflow.reduce((s, r) => s + Number(r.workflows ?? 0), 0)

  return {
    kpis: {
      creditsUsed: used,
      creditsRemaining: remaining,
      usagePct: pct,
      activeUsers: Number(uniqueUsers[0]?.n ?? 0),
      workflows: workflowTotal,
      successRate: null as number | null,
    },
    allowance: {
      included,
      used,
      remaining,
      resetDate: allowance[0]?.reset_date ? String(allowance[0].reset_date).slice(0, 10) : null,
    },
    byWorkflow: byWorkflow.map((r) => ({
      key: String(r.key),
      name: prettyInsightLabel(String(r.key)),
      workflows: Number(r.workflows),
      credits: Number(r.credits),
    })),
    byRole: byRole.map((r) => ({
      role: String(r.role),
      workflows: Number(r.workflows),
      credits: Number(r.credits),
    })),
    weekly: weekly.map((r) => ({
      week: parsePgDateOnly(r.week),
      credits: Number(r.credits),
    })),
    topConsumers: topUsers.map((r) => ({
      userId: Number(r.user_id),
      name: String(r.display_name),
      role: String(r.user_type),
      workflows: Number(r.workflows),
      credits: Number(r.credits),
      avgCredits: Number(r.workflows) > 0 ? Math.round(Number(r.credits) / Number(r.workflows)) : 0,
    })),
    alerts: coraUsageAlerts(included, used),
    projectedExhaustion: null as string | null,
    assessmentAssistance: await getInstitutionAskCoraInsights(institutionId).catch(() => null),
  }
}
