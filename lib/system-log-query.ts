import { sql } from "@/lib/db"
import { ensureSystemLogsSchema } from "@/lib/ensure-system-logs-schema"
import { mapRowToSystemLog } from "@/lib/system-log"
import type { SystemLogGroupRow, SystemLogRow } from "@/lib/system-log-constants"

export type SystemLogFilters = {
  severity?: string | null
  category?: string | null
  module?: string | null
  courseId?: number | null
  userId?: string | null
  environment?: string | null
  search?: string
  dateFrom?: Date | null
  dateTo?: Date | null
  limit?: number
  offset?: number
}

function parseDateParam(value: string | null, endOfDay: boolean): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  if (endOfDay) d.setHours(23, 59, 59, 999)
  else d.setHours(0, 0, 0, 0)
  return d
}

export function parseSystemLogSearchParams(searchParams: URLSearchParams): SystemLogFilters {
  return {
    severity: searchParams.get("severity"),
    category: searchParams.get("category"),
    module: searchParams.get("module"),
    courseId: searchParams.get("courseId") ? Number(searchParams.get("courseId")) : null,
    userId: searchParams.get("userId"),
    environment: searchParams.get("environment"),
    search: searchParams.get("search")?.trim() ?? "",
    dateFrom: parseDateParam(searchParams.get("dateFrom"), false),
    dateTo: parseDateParam(searchParams.get("dateTo"), true),
    limit: Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 500),
    offset: Math.max(Number(searchParams.get("offset") ?? 0), 0),
  }
}

export async function querySystemLogs(filters: SystemLogFilters) {
  await ensureSystemLogsSchema()

  const severityFilter = filters.severity && filters.severity !== "all" ? filters.severity : null
  const categoryFilter = filters.category && filters.category !== "all" ? filters.category : null
  const moduleFilter = filters.module && filters.module !== "all" ? filters.module : null
  const envFilter = filters.environment && filters.environment !== "all" ? filters.environment : null
  const courseFilter = filters.courseId ?? null
  const userFilter = filters.userId?.trim() || null
  const searchPattern = filters.search ? `%${filters.search}%` : null
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total FROM system_logs
    WHERE (${severityFilter}::text IS NULL OR severity = ${severityFilter})
      AND (${categoryFilter}::text IS NULL OR category = ${categoryFilter})
      AND (${moduleFilter}::text IS NULL OR module_name = ${moduleFilter})
      AND (${envFilter}::text IS NULL OR environment = ${envFilter})
      AND (${courseFilter}::int IS NULL OR course_id = ${courseFilter})
      AND (${userFilter}::text IS NULL OR user_id = ${userFilter} OR user_name ILIKE ${userFilter ? `%${userFilter}%` : null})
      AND (${filters.dateFrom}::timestamptz IS NULL OR created_at >= ${filters.dateFrom})
      AND (${filters.dateTo}::timestamptz IS NULL OR created_at <= ${filters.dateTo})
      AND (
        ${searchPattern}::text IS NULL
        OR error_message ILIKE ${searchPattern}
        OR title ILIKE ${searchPattern}
        OR page_url ILIKE ${searchPattern}
        OR api_endpoint ILIKE ${searchPattern}
        OR stack_trace ILIKE ${searchPattern}
        OR user_name ILIKE ${searchPattern}
        OR description ILIKE ${searchPattern}
      )
  `

  const rows = await sql`
    SELECT * FROM system_logs
    WHERE (${severityFilter}::text IS NULL OR severity = ${severityFilter})
      AND (${categoryFilter}::text IS NULL OR category = ${categoryFilter})
      AND (${moduleFilter}::text IS NULL OR module_name = ${moduleFilter})
      AND (${envFilter}::text IS NULL OR environment = ${envFilter})
      AND (${courseFilter}::int IS NULL OR course_id = ${courseFilter})
      AND (${userFilter}::text IS NULL OR user_id = ${userFilter} OR user_name ILIKE ${userFilter ? `%${userFilter}%` : null})
      AND (${filters.dateFrom}::timestamptz IS NULL OR created_at >= ${filters.dateFrom})
      AND (${filters.dateTo}::timestamptz IS NULL OR created_at <= ${filters.dateTo})
      AND (
        ${searchPattern}::text IS NULL
        OR error_message ILIKE ${searchPattern}
        OR title ILIKE ${searchPattern}
        OR page_url ILIKE ${searchPattern}
        OR api_endpoint ILIKE ${searchPattern}
        OR stack_trace ILIKE ${searchPattern}
        OR user_name ILIKE ${searchPattern}
        OR description ILIKE ${searchPattern}
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return {
    total: Number((countRow as { total: number }).total),
    logs: (rows as Record<string, unknown>[]).map(mapRowToSystemLog),
  }
}

export async function getSystemLogById(id: number): Promise<SystemLogRow | null> {
  await ensureSystemLogsSchema()
  const rows = await sql`SELECT * FROM system_logs WHERE id = ${id} LIMIT 1`
  if (!rows.length) return null
  return mapRowToSystemLog(rows[0] as Record<string, unknown>)
}

export async function getRelatedLogs(log: SystemLogRow, limit = 10): Promise<SystemLogRow[]> {
  await ensureSystemLogsSchema()
  if (!log.fingerprint && !log.group_id) return []

  const rows = await sql`
    SELECT * FROM system_logs
    WHERE id != ${log.id}
      AND (
        (${log.group_id}::bigint IS NOT NULL AND group_id = ${log.group_id})
        OR (${log.fingerprint}::text IS NOT NULL AND fingerprint = ${log.fingerprint})
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map(mapRowToSystemLog)
}

export async function getSystemLogStats() {
  await ensureSystemLogsSchema()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [todayStats] = await sql`
    SELECT
      COUNT(*)::int AS errors_today,
      COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical_today,
      COUNT(*) FILTER (WHERE severity IN ('error', 'critical'))::int AS error_level_today
    FROM system_logs
    WHERE created_at >= ${todayStart}
      AND severity IN ('error', 'critical', 'warning')
  `

  const [needsAttentionIssues] = await sql`
    SELECT COUNT(*)::int AS count FROM system_log_groups WHERE status = 'needs_attention'
  `

  const [openIssues] = await sql`
    SELECT COUNT(*)::int AS count FROM system_log_groups WHERE status IN ('open', 'active', 'ignored')
  `

  const [resolvedIssues] = await sql`
    SELECT COUNT(*)::int AS count FROM system_log_groups WHERE status = 'resolved'
  `

  const topModules = await sql`
    SELECT module_name, COUNT(*)::int AS count
    FROM system_logs
    WHERE created_at >= ${todayStart}
      AND severity IN ('error', 'critical')
      AND module_name IS NOT NULL
    GROUP BY module_name
    ORDER BY count DESC
    LIMIT 5
  `

  const topErrors = await sql`
    SELECT title, fingerprint, COUNT(*)::int AS count
    FROM system_logs
    WHERE created_at >= ${todayStart}
      AND severity IN ('error', 'critical')
    GROUP BY title, fingerprint
    ORDER BY count DESC
    LIMIT 5
  `

  const severityBreakdown = await sql`
    SELECT severity, COUNT(*)::int AS count
    FROM system_logs
    WHERE created_at >= ${todayStart}
    GROUP BY severity
    ORDER BY count DESC
  `

  const categoryBreakdown = await sql`
    SELECT category, COUNT(*)::int AS count
    FROM system_logs
    WHERE created_at >= ${todayStart}
      AND severity IN ('error', 'critical', 'warning')
    GROUP BY category
    ORDER BY count DESC
  `

  const distinctModules = await sql`
    SELECT DISTINCT module_name FROM system_logs
    WHERE module_name IS NOT NULL
    ORDER BY module_name ASC
    LIMIT 50
  `

  const distinctEnvironments = await sql`
    SELECT DISTINCT environment FROM system_logs ORDER BY environment ASC
  `

  return {
    today: todayStats as {
      errors_today: number
      critical_today: number
      error_level_today: number
    },
    needsAttentionIssues: Number((needsAttentionIssues as { count: number }).count),
    openIssues: Number((openIssues as { count: number }).count),
    resolvedIssues: Number((resolvedIssues as { count: number }).count),
    /** @deprecated Use openIssues */
    activeIssues: Number((openIssues as { count: number }).count),
    topModules: topModules as { module_name: string; count: number }[],
    topErrors: topErrors as { title: string; fingerprint: string; count: number }[],
    severityBreakdown: severityBreakdown as { severity: string; count: number }[],
    categoryBreakdown: categoryBreakdown as { category: string; count: number }[],
    distinctModules: (distinctModules as { module_name: string }[]).map((r) => r.module_name),
    distinctEnvironments: (distinctEnvironments as { environment: string }[]).map(
      (r) => r.environment,
    ),
  }
}

function mapSystemLogGroupRow(r: Record<string, unknown>): SystemLogGroupRow {
  return {
    id: Number(r.id),
    fingerprint: String(r.fingerprint),
    title: String(r.title),
    severity: r.severity as SystemLogGroupRow["severity"],
    category: r.category as SystemLogGroupRow["category"],
    module_name: r.module_name != null ? String(r.module_name) : null,
    latest_environment:
      r.latest_environment != null ? String(r.latest_environment) : null,
    occurrence_count: Number(r.occurrence_count),
    affected_user_count: Number(r.affected_user_count),
    first_seen_at: String(r.first_seen_at),
    last_seen_at: String(r.last_seen_at),
    status: r.status as SystemLogGroupRow["status"],
    assigned_to: r.assigned_to != null ? String(r.assigned_to) : null,
    resolution_notes: r.resolution_notes != null ? String(r.resolution_notes) : null,
    resolved_at: r.resolved_at != null ? String(r.resolved_at) : null,
    resolved_by: r.resolved_by != null ? String(r.resolved_by) : null,
  }
}

export async function querySystemLogGroups(
  status?: string | null,
  options?: { offset?: number; limit?: number },
) {
  await ensureSystemLogsSchema()
  const statusFilter = status && status !== "all" ? status : null
  const filterOpen = statusFilter === "open"
  const filterResolved = statusFilter === "resolved"
  const filterNeedsAttention = statusFilter === "needs_attention"
  const offset = Math.max(0, options?.offset ?? 0)
  const limit = Math.min(500, Math.max(1, options?.limit ?? 25))

  const [countRow] = (await sql`
    SELECT COUNT(*)::int AS total FROM system_log_groups
    WHERE (
      ${statusFilter}::text IS NULL
      OR (${filterNeedsAttention} AND status = 'needs_attention')
      OR (${filterOpen} AND status IN ('open', 'active', 'ignored'))
      OR (${filterResolved} AND status = 'resolved')
      OR (
        NOT ${filterOpen}
        AND NOT ${filterResolved}
        AND NOT ${filterNeedsAttention}
        AND status = ${statusFilter}
      )
    )
  `) as { total: number }[]

  const rows = await sql`
    SELECT
      g.*,
      (
        SELECT l.environment FROM system_logs l
        WHERE l.group_id = g.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) AS latest_environment
    FROM system_log_groups g
    WHERE (
      ${statusFilter}::text IS NULL
      OR (${filterNeedsAttention} AND g.status = 'needs_attention')
      OR (${filterOpen} AND g.status IN ('open', 'active', 'ignored'))
      OR (${filterResolved} AND g.status = 'resolved')
      OR (
        NOT ${filterOpen}
        AND NOT ${filterResolved}
        AND NOT ${filterNeedsAttention}
        AND g.status = ${statusFilter}
      )
    )
    ORDER BY g.last_seen_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  return {
    groups: (rows as Record<string, unknown>[]).map(mapSystemLogGroupRow),
    total: Number(countRow?.total ?? 0),
  }
}

export async function updateSystemLogGroup(
  groupId: number,
  update: {
    status?: string
    assignedTo?: string | null
    resolutionNotes?: string | null
    resolvedBy?: string | null
  },
) {
  await ensureSystemLogsSchema()
  const nextStatus = update.status ?? null
  const markingResolved = nextStatus === "resolved"
  const markingOpen = nextStatus === "open"
  const markingNeedsAttention = nextStatus === "needs_attention"
  const clearingResolution = markingOpen || markingNeedsAttention

  await sql`
    UPDATE system_log_groups SET
      status = COALESCE(${nextStatus}, status),
      assigned_to = COALESCE(${update.assignedTo ?? null}, assigned_to),
      resolution_notes = COALESCE(${update.resolutionNotes ?? null}, resolution_notes),
      resolved_by = CASE
        WHEN ${markingResolved} THEN COALESCE(${update.resolvedBy ?? null}, resolved_by)
        WHEN ${clearingResolution} THEN NULL
        ELSE resolved_by
      END,
      resolved_at = CASE
        WHEN ${markingResolved} THEN COALESCE(resolved_at, NOW())
        WHEN ${clearingResolution} THEN NULL
        ELSE resolved_at
      END,
      updated_at = NOW()
    WHERE id = ${groupId}
  `
}

export async function getLatestLogForGroup(groupId: number): Promise<SystemLogRow | null> {
  await ensureSystemLogsSchema()
  const rows = await sql`
    SELECT * FROM system_logs
    WHERE group_id = ${groupId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (!rows.length) return null
  return mapRowToSystemLog(rows[0] as Record<string, unknown>)
}

export async function getRecentLogsForGroup(groupId: number, limit = 5): Promise<SystemLogRow[]> {
  await ensureSystemLogsSchema()
  const rows = await sql`
    SELECT * FROM system_logs
    WHERE group_id = ${groupId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map(mapRowToSystemLog)
}

export async function getSystemLogGroupById(groupId: number): Promise<SystemLogGroupRow | null> {
  await ensureSystemLogsSchema()
  const rows = await sql`
    SELECT
      g.*,
      (
        SELECT l.environment FROM system_logs l
        WHERE l.group_id = g.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) AS latest_environment
    FROM system_log_groups g
    WHERE g.id = ${groupId}
    LIMIT 1
  `
  if (!rows.length) return null
  return mapSystemLogGroupRow(rows[0] as Record<string, unknown>)
}

export async function deleteOldSystemLogs(olderThan: Date): Promise<number> {
  await ensureSystemLogsSchema()
  const [result] = await sql`
    WITH deleted AS (
      DELETE FROM system_logs WHERE created_at < ${olderThan} RETURNING id
    )
    SELECT COUNT(*)::int AS count FROM deleted
  `
  return Number((result as { count: number }).count)
}
