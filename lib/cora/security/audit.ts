import { sql } from "@/lib/db"
import type { CoraSession } from "@/lib/cora/security/types"
import { hashPrompt } from "@/lib/cora/security/cora-session"

export type CoraAuditOutcome = "success" | "blocked" | "error"

export type CoraAuditEvent = {
  session: CoraSession
  action: string
  toolName?: string | null
  outcome: CoraAuditOutcome
  modelUsed?: string | null
  tokensConsumed?: number | null
  promptText?: string | null
  responseText?: string | null
  dataSources?: string[]
  permissionChecks?: string[]
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Persist an AI action audit row. Best-effort — never throws into the request path.
 */
export async function logCoraAuditEvent(event: CoraAuditEvent): Promise<void> {
  try {
    const courseId = event.session.courseIds[0] ?? null
    const metadata = {
      request_id: event.session.requestId,
      role: event.session.role,
      agent_role: event.session.agentRole,
      product: event.session.productName,
      institution_id: event.session.institutionId,
      course_ids: event.session.courseIds,
      section_ids: event.session.sectionIds,
      membership_tier: event.session.membershipTier,
      tool: event.toolName ?? null,
      outcome: event.outcome,
      model: event.modelUsed ?? null,
      tokens: event.tokensConsumed ?? null,
      prompt_hash: event.promptText ? hashPrompt(event.promptText) : null,
      response_hash: event.responseText ? hashPrompt(event.responseText) : null,
      data_sources: event.dataSources ?? [],
      permission_checks: event.permissionChecks ?? [...event.session.permissions],
      error: event.errorMessage ?? null,
      ...(event.metadata ?? {}),
    }

    const actorType =
      event.session.role === "student"
        ? "student"
        : event.session.role === "faculty"
          ? "instructor"
          : "admin"

    await sql`
      INSERT INTO audit_logs (
        actor_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        course_id,
        metadata
      )
      VALUES (
        ${event.session.userId},
        ${actorType},
        ${event.action},
        ${"cora_ai"},
        ${courseId},
        ${courseId},
        ${JSON.stringify(metadata)}::jsonb
      )
    `
  } catch (err) {
    console.warn("[cora/audit] failed to write audit log:", err)
  }
}
