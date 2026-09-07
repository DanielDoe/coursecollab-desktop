/**
 * Verify-and-close: resolve open groups that no longer reproduce on production
 * (fix already deployed, no recurrence) without applying a new code change.
 */

import { sql } from "@/lib/db"
import {
  REMEDIATION_ELIGIBLE_GROUP_STATUS,
  REMEDIATION_VERIFY_CLOSE_RECURRENCE_HOURS,
  REMEDIATION_VERIFY_CLOSE_STALE_HOURS,
} from "@/lib/ai-remediation-constants"
import { resolveRemediationGroup } from "@/lib/ai-remediation-db"
import {
  isProductionRemediationGroup,
  type RemediationLogContext,
} from "@/lib/ai-remediation-production"
import {
  getLatestLogForGroup,
  getRecentLogsForGroup,
  getSystemLogGroupById,
} from "@/lib/system-log-query"

export type VerifyAndCloseLog = RemediationLogContext & {
  created_at?: string | null
}

export type VerifyAndCloseInput = {
  group: {
    id: number
    fingerprint: string
    status: string
    last_seen_at: string
    title?: string | null
  }
  latestLog: VerifyAndCloseLog | null
  recentLogs?: VerifyAndCloseLog[]
  recentFingerprintCount: number
  staleHours?: number
  recurrenceHours?: number
  priorCommitHash?: string | null
  productionSmokeOk?: boolean
  smokeCheckedUrl?: string | null
}

export type VerifyAndCloseEvaluation =
  | { ok: true; notes: string; commitHash: string | null }
  | { ok: false; reason: string }

function hoursSince(dateStr: string): number | null {
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / (60 * 60 * 1000)
}

function isLogWithinHours(createdAt: string | null | undefined, hours: number): boolean {
  if (!createdAt) return false
  const elapsed = hoursSince(createdAt)
  return elapsed != null && elapsed < hours
}

/** Pure evaluation — no I/O. */
export function evaluateVerifyAndClose(input: VerifyAndCloseInput): VerifyAndCloseEvaluation {
  const staleHours = input.staleHours ?? REMEDIATION_VERIFY_CLOSE_STALE_HOURS
  const recurrenceHours = input.recurrenceHours ?? REMEDIATION_VERIFY_CLOSE_RECURRENCE_HOURS

  const normalizedStatus =
    input.group.status === "active" || input.group.status === "ignored"
      ? "open"
      : input.group.status

  if (normalizedStatus !== REMEDIATION_ELIGIBLE_GROUP_STATUS) {
    return { ok: false, reason: `Group status is ${input.group.status} (only open)` }
  }

  const production = isProductionRemediationGroup(
    input.latestLog,
    input.recentLogs ?? [],
  )
  if (!production.ok) {
    return { ok: false, reason: production.reason }
  }

  const lastSeenHours = hoursSince(input.group.last_seen_at)
  if (lastSeenHours == null) {
    return { ok: false, reason: "Invalid last_seen_at — cannot verify staleness" }
  }
  if (lastSeenHours < staleHours) {
    return {
      ok: false,
      reason: `Last seen ${lastSeenHours.toFixed(1)}h ago — wait until ${staleHours}h without recurrence`,
    }
  }

  if (input.recentFingerprintCount > 0) {
    return {
      ok: false,
      reason: `${input.recentFingerprintCount} log(s) with same fingerprint in last ${recurrenceHours}h`,
    }
  }

  const recent = input.recentLogs ?? (input.latestLog ? [input.latestLog] : [])
  for (const log of recent) {
    if (isLogWithinHours(log.created_at, recurrenceHours)) {
      return {
        ok: false,
        reason: `Recent log activity within ${recurrenceHours}h — issue may still be active`,
      }
    }
  }

  if (input.productionSmokeOk === false) {
    return {
      ok: false,
      reason: `Production smoke failed${input.smokeCheckedUrl ? ` for ${input.smokeCheckedUrl}` : ""}`,
    }
  }

  const lastSeenLabel = new Date(input.group.last_seen_at).toISOString()
  const commitNote = input.priorCommitHash
    ? ` Prior fix commit ${input.priorCommitHash}.`
    : ""
  const smokeNote =
    input.smokeCheckedUrl && input.productionSmokeOk
      ? ` Production route check passed (${input.smokeCheckedUrl}).`
      : ""

  return {
    ok: true,
    commitHash: input.priorCommitHash ?? null,
    notes:
      `Verify-and-close: no recurrence since ${lastSeenLabel} (>${staleHours}h).` +
      smokeNote +
      commitNote +
      " Issue appears resolved on production without a new patch in this run.",
  }
}

export async function countRecentLogsForFingerprint(
  fingerprint: string,
  hours: number = REMEDIATION_VERIFY_CLOSE_RECURRENCE_HOURS,
): Promise<number> {
  const [row] = (await sql`
    SELECT COUNT(*)::int AS count
    FROM system_logs
    WHERE fingerprint = ${fingerprint}
      AND created_at > NOW() - (${String(hours)} || ' hours')::interval
  `) as Array<{ count: number }>
  return Number(row?.count ?? 0)
}

export async function getPriorRemediationCommitForGroup(
  groupId: number,
): Promise<string | null> {
  const [row] = (await sql`
    SELECT commit_hash
    FROM ai_remediation_jobs
    WHERE group_id = ${groupId}
      AND status = 'completed'
      AND commit_hash IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST
    LIMIT 1
  `) as Array<{ commit_hash: string | null }>
  const hash = row?.commit_hash?.trim()
  return hash || null
}

export function resolveProductionRoute(
  route: string | null | undefined,
  pageUrl: string | null | undefined,
): string | null {
  const r = route?.trim()
  if (r) return r.startsWith("/") ? r : `/${r}`
  if (!pageUrl?.trim()) return null
  try {
    return new URL(pageUrl).pathname || null
  } catch {
    return null
  }
}

/** GET affected route on production; pass when status < 500 or no route to check. */
export async function productionRouteSmokeCheck(
  baseUrl: string,
  route: string | null | undefined,
  pageUrl: string | null | undefined,
): Promise<{ ok: boolean; checkedUrl: string | null; status: number | null }> {
  const path = resolveProductionRoute(route, pageUrl)
  if (!path) {
    return { ok: true, checkedUrl: null, status: null }
  }

  const url = `${baseUrl.replace(/\/$/, "")}${path}`
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-admin-id": "1" },
      signal: AbortSignal.timeout(15_000),
    })
    return { ok: res.status < 500, checkedUrl: url, status: res.status }
  } catch {
    return { ok: false, checkedUrl: url, status: null }
  }
}

export type VerifyAndCloseOutcome =
  | { closed: true; notes: string; commitHash: string | null }
  | { closed: false; reason: string }

/** Load group/logs, evaluate, smoke-check prod route, resolve UI if eligible. */
export async function tryVerifyAndCloseGroup(
  groupId: number,
  opts: {
    jobId?: number | null
    resolvedBy?: string
    prodUrl?: string
    staleHours?: number
    recurrenceHours?: number
    skipSmoke?: boolean
  } = {},
): Promise<VerifyAndCloseOutcome> {
  const prodUrl = (opts.prodUrl ?? "https://course-collab.com").replace(/\/$/, "")

  const group = await getSystemLogGroupById(groupId)
  if (!group) {
    return { closed: false, reason: `Group ${groupId} not found` }
  }

  const [latestLog, recentLogs] = await Promise.all([
    getLatestLogForGroup(groupId),
    getRecentLogsForGroup(groupId, 5),
  ])

  const recentFingerprintCount = await countRecentLogsForFingerprint(
    group.fingerprint,
    opts.recurrenceHours,
  )
  const priorCommitHash = await getPriorRemediationCommitForGroup(groupId)

  let productionSmokeOk: boolean | undefined
  let smokeCheckedUrl: string | null = null
  if (!opts.skipSmoke) {
    const smoke = await productionRouteSmokeCheck(
      prodUrl,
      latestLog?.route,
      latestLog?.page_url,
    )
    productionSmokeOk = smoke.ok
    smokeCheckedUrl = smoke.checkedUrl
  }

  const evaluation = evaluateVerifyAndClose({
    group: {
      id: group.id,
      fingerprint: group.fingerprint,
      status: group.status,
      last_seen_at: group.last_seen_at,
      title: group.title,
    },
    latestLog: latestLog
      ? {
          environment: latestLog.environment,
          page_url: latestLog.page_url,
          route: latestLog.route,
          api_endpoint: latestLog.api_endpoint,
          title: latestLog.title,
          created_at: latestLog.created_at,
        }
      : null,
    recentLogs: recentLogs.map((log) => ({
      environment: log.environment,
      page_url: log.page_url,
      route: log.route,
      api_endpoint: log.api_endpoint,
      title: log.title,
      created_at: log.created_at,
    })),
    recentFingerprintCount,
    staleHours: opts.staleHours,
    recurrenceHours: opts.recurrenceHours,
    priorCommitHash,
    productionSmokeOk,
    smokeCheckedUrl,
  })

  if (!evaluation.ok) {
    return { closed: false, reason: evaluation.reason }
  }

  await resolveRemediationGroup(groupId, {
    jobId: opts.jobId ?? null,
    resolvedBy: opts.resolvedBy ?? "ai-remediation:verify-close",
    notes: evaluation.notes,
    commitHash: evaluation.commitHash,
  })

  return {
    closed: true,
    notes: evaluation.notes,
    commitHash: evaluation.commitHash,
  }
}
