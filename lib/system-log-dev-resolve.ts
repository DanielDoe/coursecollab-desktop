/**
 * Dev-environment issue lifecycle: bulk resolve stale localhost noise and
 * auto-close quiet dev groups after fixes land (no new events).
 */

import { ensureRemediationSchema } from "@/lib/ai-remediation-db"
import { sql } from "@/lib/db"
import { DEV_QUIET_RESOLVE_MINUTES, isDevLogEnvironment } from "@/lib/system-log-constants"
import { updateSystemLogGroup } from "@/lib/system-log-query"

type OpenDevGroupRow = {
  id: number
  latest_environment: string | null
  last_seen_at: string
}

async function listOpenDevGroups(opts?: { quietMinutes?: number }): Promise<OpenDevGroupRow[]> {
  const quietMinutes = opts?.quietMinutes
  const rows =
    quietMinutes != null
      ? ((await sql`
          SELECT
            g.id,
            g.last_seen_at,
            (
              SELECT l.environment
              FROM system_logs l
              WHERE l.group_id = g.id
              ORDER BY l.created_at DESC
              LIMIT 1
            ) AS latest_environment
          FROM system_log_groups g
          WHERE g.status IN ('open', 'active', 'ignored')
            AND g.last_seen_at < NOW() - (${quietMinutes}::int * INTERVAL '1 minute')
          ORDER BY g.last_seen_at DESC
        `) as OpenDevGroupRow[])
      : ((await sql`
          SELECT
            g.id,
            g.last_seen_at,
            (
              SELECT l.environment
              FROM system_logs l
              WHERE l.group_id = g.id
              ORDER BY l.created_at DESC
              LIMIT 1
            ) AS latest_environment
          FROM system_log_groups g
          WHERE g.status IN ('open', 'active', 'ignored')
          ORDER BY g.last_seen_at DESC
        `) as OpenDevGroupRow[])

  return rows.filter((r) => isDevLogEnvironment(r.latest_environment))
}

async function cancelActiveRemediationJobs(groupId: number, reason: string): Promise<void> {
  await ensureRemediationSchema()
  await sql`
    UPDATE ai_remediation_jobs SET
      status = 'failed',
      error_message = ${reason},
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
    WHERE group_id = ${groupId}
      AND status IN ('queued', 'investigating', 'fixing', 'validating', 'deploying', 'monitoring')
  `
}

async function resolveDevGroup(
  groupId: number,
  resolvedBy: string,
  notes: string,
): Promise<void> {
  await cancelActiveRemediationJobs(
    groupId,
    "Cancelled — dev issue resolved (bulk or quiet sweep)",
  )
  await updateSystemLogGroup(groupId, {
    status: "resolved",
    resolutionNotes: notes,
    resolvedBy,
  })
}

export async function bulkResolveOpenDevGroups(opts?: {
  resolvedBy?: string
  notes?: string
}): Promise<{ resolvedCount: number; groupIds: number[] }> {
  const resolvedBy = opts?.resolvedBy ?? "admin:dev-bulk-resolve"
  const notes =
    opts?.notes?.trim() ||
    "Bulk resolved: dev-only issue (localhost/preview). Production remediation queue excludes dev groups."

  const candidates = await listOpenDevGroups()
  const groupIds: number[] = []

  for (const row of candidates) {
    await resolveDevGroup(row.id, resolvedBy, notes)
    groupIds.push(row.id)
  }

  return { resolvedCount: groupIds.length, groupIds }
}

export async function sweepQuietDevOpenGroups(opts?: {
  quietMinutes?: number
  resolvedBy?: string
}): Promise<{ resolvedCount: number; groupIds: number[] }> {
  const quietMinutes = opts?.quietMinutes ?? DEV_QUIET_RESOLVE_MINUTES
  const resolvedBy = opts?.resolvedBy ?? "system:dev-quiet-sweep"
  const notes = `Auto-resolved: dev issue quiet for ${quietMinutes}+ minutes (no new events after fix).`

  const candidates = await listOpenDevGroups({ quietMinutes })
  const groupIds: number[] = []

  for (const row of candidates) {
    await resolveDevGroup(row.id, resolvedBy, notes)
    groupIds.push(row.id)
  }

  return { resolvedCount: groupIds.length, groupIds }
}
