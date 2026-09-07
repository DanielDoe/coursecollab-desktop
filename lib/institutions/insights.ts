import { sql } from "@/lib/db"

export type InstitutionWeekPoint = {
  week: string
  label: string
  credits: number
  workflows: number
  activeUsers: number
}

export type InstitutionNamedCount = {
  name: string
  key: string
  value: number
  credits?: number
}

const WORKFLOW_LABELS: Record<string, string> = {
  grading: "Auto-grading",
  grade: "Auto-grading",
  chat: "Cora chat",
  tutor: "Tutoring",
  quiz: "Quizzes",
  homework: "Homework",
  lecture: "Lectures",
  notes: "Notes",
  other: "Other",
  unknown: "Unspecified",
  student: "Students",
  instructor: "Faculty",
  institution_admin: "Admins",
}

function formatInsightLabelPart(part: string): string {
  return part.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Other"
}

export function prettyInsightLabel(raw: string): string {
  const key = raw.trim().toLowerCase()
  if (WORKFLOW_LABELS[key]) return WORKFLOW_LABELS[key]
  const parts = key.split(":").map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1) return parts.map(formatInsightLabelPart).join(" · ")
  return formatInsightLabelPart(key)
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value ?? "")
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return raw.slice(0, 10)
}

function weekLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

export async function getInstitutionInsights(institutionId: number) {
  const [weeklyRows, workflowRows, roleRows] = await Promise.all([
    sql`
      SELECT
        gs::date AS week,
        COALESCE(u.workflows, 0)::int AS workflows,
        COALESCE(u.credits, 0)::int AS credits,
        COALESCE(u.active_users, 0)::int AS active_users
      FROM generate_series(
        date_trunc('week', NOW() - INTERVAL '11 weeks'),
        date_trunc('week', NOW()),
        INTERVAL '1 week'
      ) AS gs
      LEFT JOIN (
        SELECT
          date_trunc('week', created_at) AS week,
          COUNT(*)::int AS workflows,
          COALESCE(SUM(credits), 0)::int AS credits,
          COUNT(DISTINCT user_id)::int AS active_users
        FROM institution_cora_usage
        WHERE institution_id = ${institutionId}
          AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY 1
      ) u ON u.week = gs
      ORDER BY 1
    `,
    sql`
      SELECT
        COALESCE(NULLIF(TRIM(workflow_type), ''), 'other') AS key,
        COUNT(*)::int AS value,
        COALESCE(SUM(credits), 0)::int AS credits
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 8
    `,
    sql`
      SELECT
        COALESCE(NULLIF(TRIM(user_type), ''), 'unknown') AS key,
        COUNT(*)::int AS value
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
      GROUP BY 1
      ORDER BY 2 DESC
    `,
  ])

  const weekly: InstitutionWeekPoint[] = weeklyRows.map((row) => {
    const week = toIsoDate(row.week)
    return {
      week,
      label: weekLabel(week),
      credits: Number(row.credits ?? 0),
      workflows: Number(row.workflows ?? 0),
      activeUsers: Number(row.active_users ?? 0),
    }
  })

  const workflows: InstitutionNamedCount[] = workflowRows.map((row) => {
    const key = String(row.key ?? "other")
    return {
      key,
      name: prettyInsightLabel(key),
      value: Number(row.value ?? 0),
      credits: Number(row.credits ?? 0),
    }
  })

  const roles: InstitutionNamedCount[] = roleRows.map((row) => {
    const key = String(row.key ?? "unknown")
    return {
      key,
      name: prettyInsightLabel(key),
      value: Number(row.value ?? 0),
    }
  })

  const hasActivity = weekly.some((w) => w.credits > 0 || w.workflows > 0)

  return { weekly, workflows, roles, hasActivity }
}
