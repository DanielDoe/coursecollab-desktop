/**
 * Shared AI remediation persistence — used by worker, admin API, and Cursor automation.
 * UI issue workflow lives in system_log_groups; jobs/events are in ai_remediation_* tables.
 */

import { sql } from "@/lib/db"
import {
  ASSESSMENT_ISSUE_FINGERPRINT_PREFIX,
  REMEDIATION_ELIGIBLE_GROUP_STATUS,
  type RemediationEventType,
  type RemediationJobStatus,
  type RemediationPriority,
} from "@/lib/ai-remediation-constants"
import { isProductionRemediationGroup } from "@/lib/ai-remediation-production"
import { isDevLogEnvironment } from "@/lib/system-log-constants"
import { updateSystemLogGroup } from "@/lib/system-log-query"
import { logSystemEvent } from "@/lib/system-log"

export type RemediationJobRow = {
  id: number
  group_id: number
  fingerprint: string
  status: RemediationJobStatus
  priority: RemediationPriority
  confidence_score: number | null
  root_cause: string | null
  fix_strategy: string | null
  branch_name: string | null
  commit_hash: string | null
  commit_message: string | null
  deployment_id: string | null
  error_message: string | null
  requires_human_reason: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  group_title?: string
  group_status?: string
  group_severity?: string
  group_module?: string | null
}

const ACTIVE_JOB_STATUSES = [
  "queued",
  "investigating",
  "fixing",
  "validating",
  "deploying",
  "monitoring",
] as const

export async function ensureRemediationSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_remediation_jobs (
      id BIGSERIAL PRIMARY KEY,
      group_id BIGINT NOT NULL REFERENCES system_log_groups(id) ON DELETE CASCADE,
      fingerprint VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'queued',
      priority VARCHAR(16) NOT NULL DEFAULT 'medium',
      confidence_score NUMERIC(5,2),
      root_cause TEXT,
      diagnosis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      fix_strategy TEXT,
      files_modified JSONB NOT NULL DEFAULT '[]'::jsonb,
      branch_name VARCHAR(255),
      commit_hash VARCHAR(64),
      commit_message TEXT,
      deployment_id VARCHAR(128),
      deployment_url TEXT,
      validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      monitoring_until TIMESTAMPTZ,
      monitoring_window_minutes INTEGER,
      error_message TEXT,
      requires_human_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ai_remediation_events (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES ai_remediation_jobs(id) ON DELETE CASCADE,
      group_id BIGINT REFERENCES system_log_groups(id) ON DELETE SET NULL,
      event_type VARCHAR(64) NOT NULL,
      message TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

function severityToPriority(severity: string): RemediationPriority {
  if (severity === "critical") return "critical"
  if (severity === "error") return "high"
  if (severity === "warning") return "medium"
  return "low"
}

export function isGroupEligibleForRemediation(group: {
  status: string
  fingerprint: string
  latest_environment?: string | null
}): { ok: true } | { ok: false; reason: string } {
  const normalized =
    group.status === "active" || group.status === "ignored" ? "open" : group.status
  if (normalized !== REMEDIATION_ELIGIBLE_GROUP_STATUS) {
    return { ok: false, reason: `status=${group.status} (only open)` }
  }
  if (group.fingerprint.startsWith(ASSESSMENT_ISSUE_FINGERPRINT_PREFIX)) {
    return { ok: false, reason: "assessment panel issue — admin triage only" }
  }
  if (isDevLogEnvironment(group.latest_environment)) {
    return {
      ok: false,
      reason: "dev environment — excluded from production remediation (auto-resolved via quiet sweep)",
    }
  }
  return { ok: true }
}

async function fetchLatestLogContextForGroup(groupId: number) {
  const [latest] = (await sql`
    SELECT environment, page_url, route, api_endpoint, title
    FROM system_logs
    WHERE group_id = ${groupId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{
    environment: string | null
    page_url: string | null
    route: string | null
    api_endpoint: string | null
    title: string | null
  }>
  return latest ?? null
}

/** Enqueue one group if eligible and no active job exists. */
export async function enqueueGroupForRemediation(groupId: number): Promise<boolean> {
  await ensureRemediationSchema()
  const [g] = await sql`
    SELECT
      g.id,
      g.fingerprint,
      g.severity,
      g.status,
      (
        SELECT l.environment
        FROM system_logs l
        WHERE l.group_id = g.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) AS latest_environment
    FROM system_log_groups g
    WHERE g.id = ${groupId}
    LIMIT 1
  ` as Array<{
    id: number
    fingerprint: string
    severity: string
    status: string
    latest_environment: string | null
  }>
  if (!g) return false

  const eligible = isGroupEligibleForRemediation(g)
  if (!eligible.ok) return false

  const latestLog = await fetchLatestLogContextForGroup(g.id)
  const production = isProductionRemediationGroup(latestLog)
  if (!production.ok) return false

  const existing = (await sql`
    SELECT id FROM ai_remediation_jobs
    WHERE group_id = ${g.id}
      AND status = ANY(${ACTIVE_JOB_STATUSES})
    LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length > 0) return false

  await sql`
    INSERT INTO ai_remediation_jobs (group_id, fingerprint, status, priority)
    VALUES (${g.id}, ${g.fingerprint}, 'queued', ${severityToPriority(g.severity)})
  `
  return true
}

/** Enqueue open groups that have no active remediation job. Returns count enqueued. */
export async function enqueueOpenGroupsForRemediation(): Promise<number> {
  await ensureRemediationSchema()
  const groups = await sql`
    SELECT
      g.id,
      g.fingerprint,
      g.severity,
      g.status,
      (
        SELECT l.environment
        FROM system_logs l
        WHERE l.group_id = g.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) AS latest_environment
    FROM system_log_groups g
    WHERE g.status IN ('open', 'active', 'ignored')
    ORDER BY
      CASE g.severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      g.last_seen_at DESC
  ` as Array<{
    id: number
    fingerprint: string
    severity: string
    status: string
    latest_environment: string | null
  }>

  let enqueued = 0
  for (const g of groups) {
    const eligible = isGroupEligibleForRemediation(g)
    if (!eligible.ok) continue

    const latestLog = await fetchLatestLogContextForGroup(g.id)
    const production = isProductionRemediationGroup(latestLog)
    if (!production.ok) continue

    const existing = (await sql`
      SELECT id FROM ai_remediation_jobs
      WHERE group_id = ${g.id}
        AND status = ANY(${ACTIVE_JOB_STATUSES})
      LIMIT 1
    `) as Array<{ id: number }>
    if (existing.length > 0) continue

    await sql`
      INSERT INTO ai_remediation_jobs (group_id, fingerprint, status, priority)
      VALUES (${g.id}, ${g.fingerprint}, 'queued', ${severityToPriority(g.severity)})
    `
    enqueued++
  }
  return enqueued
}

export async function emitRemediationEvent(
  jobId: number,
  groupId: number,
  eventType: RemediationEventType,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await ensureRemediationSchema()
  await sql`
    INSERT INTO ai_remediation_events (job_id, group_id, event_type, message, metadata)
    VALUES (${jobId}, ${groupId}, ${eventType}, ${message}, ${JSON.stringify(metadata)}::jsonb)
  `
  await logSystemEvent({
    severity: "info",
    category: "deployment",
    title: message,
    description: `AI remediation job ${jobId}: ${eventType}`,
    moduleName: "Administration Module",
    metadata: { jobId, groupId, eventType, ...metadata },
    alwaysGroup: false,
  })
}

export async function setRemediationJobStatus(
  jobId: number,
  status: RemediationJobStatus,
  patch: Record<string, unknown> = {},
): Promise<void> {
  await ensureRemediationSchema()
  await sql`
    UPDATE ai_remediation_jobs SET
      status = ${status},
      updated_at = NOW(),
      started_at = CASE WHEN ${status} = 'investigating' AND started_at IS NULL THEN NOW() ELSE started_at END,
      completed_at = CASE WHEN ${status} IN ('completed','failed','requires_human_review') THEN NOW() ELSE completed_at END,
      root_cause = COALESCE(${patch.rootCause ?? null}, root_cause),
      diagnosis_json = COALESCE(${patch.diagnosisJson ? JSON.stringify(patch.diagnosisJson) : null}::jsonb, diagnosis_json),
      fix_strategy = COALESCE(${patch.fixStrategy ?? null}, fix_strategy),
      confidence_score = COALESCE(${patch.confidence ?? null}, confidence_score),
      files_modified = COALESCE(${patch.filesModified ? JSON.stringify(patch.filesModified) : null}::jsonb, files_modified),
      branch_name = COALESCE(${patch.branchName ?? null}, branch_name),
      commit_hash = COALESCE(${patch.commitHash ?? null}, commit_hash),
      commit_message = COALESCE(${patch.commitMessage ?? null}, commit_message),
      deployment_id = COALESCE(${patch.deploymentId ?? null}, deployment_id),
      deployment_url = COALESCE(${patch.deploymentUrl ?? null}, deployment_url),
      validation_json = COALESCE(${patch.validationJson ? JSON.stringify(patch.validationJson) : null}::jsonb, validation_json),
      monitoring_until = COALESCE(${patch.monitoringUntil ?? null}, monitoring_until),
      monitoring_window_minutes = COALESCE(${patch.monitoringWindowMinutes ?? null}, monitoring_window_minutes),
      error_message = COALESCE(${patch.errorMessage ?? null}, error_message),
      requires_human_reason = COALESCE(${patch.requiresHumanReason ?? null}, requires_human_reason)
    WHERE id = ${jobId}
  `
}

/**
 * Mark a grouped issue resolved in the UI (system_log_groups) after a verified fix.
 * This is what the admin Issues tab reads — automation MUST call this to close the loop.
 */
export async function resolveRemediationGroup(
  groupId: number,
  opts: {
    jobId?: number | null
    resolvedBy?: string
    notes: string
    commitHash?: string | null
  },
): Promise<void> {
  const resolvedBy =
    opts.resolvedBy ??
    (opts.jobId != null ? `ai-remediation:${opts.jobId}` : "ai-remediation:agent")

  let notes = opts.notes
  if (opts.commitHash) {
    notes = `${notes}${notes ? " " : ""}(commit ${opts.commitHash})`
  }

  await updateSystemLogGroup(groupId, {
    status: "resolved",
    resolutionNotes: notes,
    resolvedBy,
  })

  if (opts.jobId != null) {
    await setRemediationJobStatus(opts.jobId, "completed", {
      commitHash: opts.commitHash ?? undefined,
    })
    await emitRemediationEvent(
      opts.jobId,
      groupId,
      "issue_resolved",
      `Group ${groupId} marked resolved in UI`,
      { commitHash: opts.commitHash ?? null },
    )
  }
}

export async function failRemediationJob(
  groupId: number,
  opts: { jobId?: number | null; reason: string; reopenGroup?: boolean },
): Promise<void> {
  if (opts.jobId != null) {
    await setRemediationJobStatus(opts.jobId, "failed", {
      errorMessage: opts.reason,
      requiresHumanReason: opts.reason,
    })
    await emitRemediationEvent(opts.jobId, groupId, "ai_validation_failed", opts.reason)
  }
  if (opts.reopenGroup) {
    await updateSystemLogGroup(groupId, { status: "open" })
  }
}

export async function queryRemediationQueue(limit = 50): Promise<{
  jobs: RemediationJobRow[]
  summary: Record<RemediationJobStatus, number>
}> {
  await ensureRemediationSchema()
  const rows = await sql`
    SELECT
      j.id, j.group_id, j.fingerprint, j.status, j.priority,
      j.confidence_score, j.root_cause, j.fix_strategy,
      j.branch_name, j.commit_hash, j.commit_message, j.deployment_id,
      j.error_message, j.requires_human_reason,
      j.created_at, j.updated_at, j.started_at, j.completed_at,
      g.title AS group_title, g.status AS group_status,
      g.severity AS group_severity, g.module_name AS group_module
    FROM ai_remediation_jobs j
    JOIN system_log_groups g ON g.id = j.group_id
    ORDER BY j.updated_at DESC
    LIMIT ${limit}
  `

  const summaryRows = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM ai_remediation_jobs
    GROUP BY status
  `

  const summary = {
    queued: 0,
    investigating: 0,
    fixing: 0,
    validating: 0,
    deploying: 0,
    monitoring: 0,
    completed: 0,
    failed: 0,
    requires_human_review: 0,
  } as Record<RemediationJobStatus, number>

  for (const r of summaryRows as Array<{ status: string; count: number }>) {
    const s = r.status as RemediationJobStatus
    if (s in summary) summary[s] = Number(r.count)
  }

  const jobs = (rows as Record<string, unknown>[]).map(
    (r): RemediationJobRow => ({
      id: Number(r.id),
      group_id: Number(r.group_id),
      fingerprint: String(r.fingerprint),
      status: r.status as RemediationJobStatus,
      priority: r.priority as RemediationPriority,
      confidence_score: r.confidence_score != null ? Number(r.confidence_score) : null,
      root_cause: r.root_cause != null ? String(r.root_cause) : null,
      fix_strategy: r.fix_strategy != null ? String(r.fix_strategy) : null,
      branch_name: r.branch_name != null ? String(r.branch_name) : null,
      commit_hash: r.commit_hash != null ? String(r.commit_hash) : null,
      commit_message: r.commit_message != null ? String(r.commit_message) : null,
      deployment_id: r.deployment_id != null ? String(r.deployment_id) : null,
      error_message: r.error_message != null ? String(r.error_message) : null,
      requires_human_reason:
        r.requires_human_reason != null ? String(r.requires_human_reason) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      started_at: r.started_at != null ? String(r.started_at) : null,
      completed_at: r.completed_at != null ? String(r.completed_at) : null,
      group_title: r.group_title != null ? String(r.group_title) : undefined,
      group_status: r.group_status != null ? String(r.group_status) : undefined,
      group_severity: r.group_severity != null ? String(r.group_severity) : undefined,
      group_module: r.group_module != null ? String(r.group_module) : null,
    }),
  )

  return { jobs, summary }
}

export async function getLatestJobForGroup(groupId: number): Promise<RemediationJobRow | null> {
  await ensureRemediationSchema()
  const { jobs } = await queryRemediationQueue(200)
  return jobs.find((j) => j.group_id === groupId) ?? null
}

export async function getRemediationEventsForJob(jobId: number, limit = 30) {
  await ensureRemediationSchema()
  const rows = await sql`
    SELECT id, job_id, group_id, event_type, message, metadata, created_at
    FROM ai_remediation_events
    WHERE job_id = ${jobId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows as Array<{
    id: number
    job_id: number
    group_id: number | null
    event_type: string
    message: string | null
    metadata: Record<string, unknown>
    created_at: string
  }>
}
