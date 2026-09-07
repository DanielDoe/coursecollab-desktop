/**
 * Shared helpers for /api/instructor/reports — scoring denominators, date filters, payloads.
 */
import { sql } from "@/lib/db"

/** Max points for quiz q (matches gradebook / results where possible). */
export const SQL_QUIZ_MAX_POINTS =
  "(SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id)"

/**
 * Optional date filter on attempt completion (validated YYYY-MM-DD only).
 * Empty fragments when no valid dates.
 */
export function attemptCompletedDateSql(filters: Record<string, unknown>) {
  const start =
    typeof filters?.startDate === "string" ? filters.startDate.trim() : ""
  const end = typeof filters?.endDate === "string" ? filters.endDate.trim() : ""
  const parts: string[] = []
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    parts.push(`qa.completed_at::date >= '${start}'::date`)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    parts.push(`qa.completed_at::date <= '${end}'::date`)
  }
  return parts.length ? sql.unsafe(` AND ${parts.join(" AND ")}`) : sql.unsafe("")
}

export function flattenLearningAnalyticsForTables(bundle: {
  dailyActivity?: unknown[]
  topPerformers?: unknown[]
  strugglingStudents?: unknown[]
  insights?: Record<string, unknown>
}) {
  const rows: Record<string, unknown>[] = []
  for (const d of bundle.dailyActivity ?? []) {
    rows.push({
      recordType: "daily_activity",
      ...(typeof d === "object" && d ? (d as object) : {}),
    })
  }
  for (const p of bundle.topPerformers ?? []) {
    rows.push({
      recordType: "top_performer",
      ...(typeof p === "object" && p ? (p as object) : {}),
    })
  }
  for (const s of bundle.strugglingStudents ?? []) {
    rows.push({
      recordType: "struggling_student",
      ...(typeof s === "object" && s ? (s as object) : {}),
    })
  }
  if (bundle.insights && typeof bundle.insights === "object") {
    rows.push({
      recordType: "insights_summary",
      ...bundle.insights,
    })
  }
  return rows
}
