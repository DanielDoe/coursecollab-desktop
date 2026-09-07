import { type NextRequest, NextResponse } from "next/server"
import {
  enqueueOpenGroupsForRemediation,
  failRemediationJob,
  getLatestJobForGroup,
  getRemediationEventsForJob,
  queryRemediationQueue,
  resolveRemediationGroup,
  setRemediationJobStatus,
  emitRemediationEvent,
} from "@/lib/ai-remediation-db"
import { tryVerifyAndCloseGroup } from "@/lib/ai-remediation-verify-close"
import { requireRemediationAccess } from "@/lib/remediation-api-auth"
import {
  bulkResolveOpenDevGroups,
  sweepQuietDevOpenGroups,
} from "@/lib/system-log-dev-resolve"

export const dynamic = "force-dynamic"

/** GET — remediation job queue (for admin UI + Cursor automation polling). */
export async function GET(request: NextRequest) {
  const auth = await requireRemediationAccess(request)
  if (!auth.ok) return auth.response

  try {
    const jobId = request.nextUrl.searchParams.get("jobId")
    if (jobId) {
      const events = await getRemediationEventsForJob(Number(jobId))
      return NextResponse.json({ events })
    }

    const groupId = request.nextUrl.searchParams.get("groupId")
    if (groupId) {
      const job = await getLatestJobForGroup(Number(groupId))
      return NextResponse.json({ job })
    }

    const { jobs, summary } = await queryRemediationQueue(80)
    return NextResponse.json({ jobs, summary })
  } catch (error) {
    console.error("[admin/system-logs/remediation] GET failed", error)
    return NextResponse.json({ error: "Failed to load remediation queue" }, { status: 500 })
  }
}

/**
 * POST — automation actions (Cursor agent MUST call resolve after deploy).
 *
 * Actions:
 *   scan                  — sweep quiet dev groups, then enqueue open prod groups
 *   resolve-dev-open      — bulk resolve all open dev-environment groups
 *   sweep-quiet-dev       — auto-resolve dev groups with no new events (default 30 min)
 *   assessment-auto-heal  — proactively repair common assessment defects (no groupId)
 *   verify-close          — resolve if no recurrence + production route healthy (already fixed)
 *   resolve           — mark system_log_groups resolved (updates admin UI)
 *   fail              — mark job failed, optionally keep group open
 *   progress          — update job status from agent (investigating, fixing, etc.)
 */
export async function POST(request: NextRequest) {
  const auth = await requireRemediationAccess(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const action = String(body.action ?? "").trim()

    if (action === "scan") {
      const quietSweep = await sweepQuietDevOpenGroups({
        resolvedBy: auth.actorId,
      })
      const enqueued = await enqueueOpenGroupsForRemediation()
      const queue = await queryRemediationQueue(80)
      return NextResponse.json({ ok: true, quietSweep, enqueued, ...queue })
    }

    if (action === "resolve-dev-open") {
      const notes = String(body.notes ?? "").trim() || undefined
      const result = await bulkResolveOpenDevGroups({
        resolvedBy: auth.actorId,
        notes,
      })
      return NextResponse.json({
        ok: true,
        ...result,
        message: `Resolved ${result.resolvedCount} dev issue(s). Refresh Issues tab.`,
      })
    }

    if (action === "sweep-quiet-dev") {
      const quietMinutes =
        body.quietMinutes != null && Number.isFinite(Number(body.quietMinutes))
          ? Number(body.quietMinutes)
          : undefined
      const result = await sweepQuietDevOpenGroups({
        quietMinutes,
        resolvedBy: auth.actorId,
      })
      return NextResponse.json({
        ok: true,
        ...result,
        message: `Auto-resolved ${result.resolvedCount} quiet dev issue(s).`,
      })
    }

    if (action === "assessment-auto-heal") {
      const { runAssessmentAutoHeal } = await import("@/lib/assessment-auto-heal")
      const dryRun = body.dryRun === true
      const lookbackDays =
        body.lookbackDays != null && Number.isFinite(Number(body.lookbackDays))
          ? Number(body.lookbackDays)
          : 45
      const result = await runAssessmentAutoHeal({ dryRun, lookbackDays })
      return NextResponse.json({
        ok: true,
        action: "assessment-auto-heal",
        dryRun,
        lookbackDays,
        ...result,
        message: dryRun
          ? `Dry-run scan: ${Object.values(result.scanned).reduce((a, b) => a + b, 0)} candidate(s)`
          : `Healed ${result.healed.length} defect(s); ${result.skipped.length} skipped; ${result.errors.length} error(s)`,
      })
    }

    const groupId = Number(body.groupId)
    if (!Number.isFinite(groupId)) {
      return NextResponse.json({ error: "groupId required" }, { status: 400 })
    }

    const jobId =
      body.jobId != null && Number.isFinite(Number(body.jobId)) ? Number(body.jobId) : null
    const latestJob = jobId == null ? await getLatestJobForGroup(groupId) : null
    const effectiveJobId = jobId ?? latestJob?.id ?? null

    if (action === "verify-close") {
      const outcome = await tryVerifyAndCloseGroup(groupId, {
        jobId: effectiveJobId,
        resolvedBy: auth.actorId,
        prodUrl:
          body.prodUrl != null
            ? String(body.prodUrl)
            : process.env.REMEDIATION_PROD_URL ?? "https://course-collab.com",
        skipSmoke: body.skipSmoke === true,
      })
      if (!outcome.closed) {
        return NextResponse.json({
          ok: false,
          groupId,
          jobId: effectiveJobId,
          closed: false,
          reason: outcome.reason,
        })
      }
      return NextResponse.json({
        ok: true,
        groupId,
        jobId: effectiveJobId,
        closed: true,
        status: "resolved",
        notes: outcome.notes,
        commitHash: outcome.commitHash,
        message: "Verify-and-close: issue marked resolved — no recurrence on production.",
      })
    }

    if (action === "resolve") {
      const notes =
        String(body.notes ?? body.resolutionNotes ?? "").trim() ||
        "Resolved by AI remediation agent after verified fix."
      await resolveRemediationGroup(groupId, {
        jobId: effectiveJobId,
        resolvedBy: auth.actorId,
        notes,
        commitHash: body.commitHash != null ? String(body.commitHash) : null,
      })
      return NextResponse.json({
        ok: true,
        groupId,
        jobId: effectiveJobId,
        status: "resolved",
        message: "Issue marked resolved — refresh Issues tab to see update.",
      })
    }

    if (action === "fail") {
      const reason = String(body.reason ?? body.error ?? "Remediation failed").trim()
      await failRemediationJob(groupId, {
        jobId: effectiveJobId,
        reason,
        reopenGroup: body.reopenGroup !== false,
      })
      return NextResponse.json({ ok: true, groupId, jobId: effectiveJobId, status: "failed" })
    }

    if (action === "progress") {
      const status = String(body.status ?? "").trim()
      if (!status) {
        return NextResponse.json({ error: "status required for progress" }, { status: 400 })
      }
      if (effectiveJobId == null) {
        return NextResponse.json({ error: "No remediation job for group" }, { status: 404 })
      }
      await setRemediationJobStatus(effectiveJobId, status as never, {
        rootCause: body.rootCause,
        fixStrategy: body.fixStrategy,
        commitHash: body.commitHash,
        branchName: body.branchName,
        errorMessage: body.errorMessage,
        requiresHumanReason: body.requiresHumanReason,
      })
      if (body.eventType && body.message) {
        await emitRemediationEvent(
          effectiveJobId,
          groupId,
          body.eventType,
          String(body.message),
          body.metadata ?? {},
        )
      }
      return NextResponse.json({ ok: true, jobId: effectiveJobId, status })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error("[admin/system-logs/remediation] POST failed", error)
    return NextResponse.json({ error: "Remediation action failed" }, { status: 500 })
  }
}
