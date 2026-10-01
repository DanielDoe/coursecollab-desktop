import { sql } from "@/lib/db"
import { redactObject } from "@/lib/compliance/log-redact"
import {
  SECURITY_AUDIT_ACTIONS,
  type SecurityAuditAction,
  type SecurityEventScope,
} from "@/lib/security/actions"
import { ensureStage6dPrivilegedAudit } from "@/lib/institutions/stage6d-schema"
import { logPlatformActivityFromRequest } from "@/lib/platform-activity-log"
import type { NextRequest } from "next/server"

export class SecurityAuditPersistenceError extends Error {
  constructor(message = "security audit persistence failed") {
    super(message)
    this.name = "SecurityAuditPersistenceError"
  }
}

const ACADEMIC_PAYLOAD_KEYS =
  /(selected_answer|answer_data|student_answer|source_code|source|code_text|conversation|transcript|file_contents|file_bytes|password|token|cookie|api[_-]?key)/i

function sanitizeAuditMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const redacted = redactObject(input)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(redacted)) {
    out[key] = ACADEMIC_PAYLOAD_KEYS.test(key) ? "[redacted]" : value
  }
  return out
}

export async function recordSecurityAuditEvent(input: {
  actorType?: string | null
  actorId?: number | null
  institutionId?: number | null
  action: SecurityAuditAction | string
  resourceType?: string | null
  resourceId?: string | number | null
  result?: "success" | "denied" | "error"
  reasonCode?: string | null
  eventScope?: SecurityEventScope
  requestId?: string | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
  failClosed?: boolean
}): Promise<void> {
  const metadata = sanitizeAuditMetadata(input.metadata ?? {})
  const eventScope: SecurityEventScope =
    input.eventScope ?? (input.institutionId != null ? "institution" : "platform")
  try {
    await ensureStage6dPrivilegedAudit()
    await sql`
      INSERT INTO security_audit_events (
        actor_role, actor_id, action, resource_type, resource_id, outcome, metadata,
        institution_id, reason_code, event_scope, request_id, ip, user_agent
      ) VALUES (
        ${input.actorType ?? null},
        ${input.actorId ?? null},
        ${input.action},
        ${input.resourceType ?? null},
        ${input.resourceId == null ? null : String(input.resourceId)},
        ${input.result ?? "success"},
        ${JSON.stringify(metadata)}::jsonb,
        ${input.institutionId ?? null},
        ${input.reasonCode ?? null},
        ${eventScope},
        ${input.requestId ?? null},
        ${input.ip ?? null},
        ${input.userAgent ?? null}
      )
    `
  } catch (error) {
    if (input.failClosed) {
      throw error instanceof SecurityAuditPersistenceError
        ? error
        : new SecurityAuditPersistenceError()
    }
    console.error("[security-audit] persist failed", error)
  }
}

export function requestAuditMeta(request: Request): {
  ip: string | null
  userAgent: string | null
  requestId: string | null
} {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent"),
    requestId: request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id"),
  }
}

export { SECURITY_AUDIT_ACTIONS }

/** Legacy desktop-only action set, kept for the `logSecurityEvent` compatibility shim below. */
export type LegacySecurityAuditAction =
  | "role.change"
  | "permission.change"
  | "assessment.publish"
  | "grade.change"
  | "account.approve"
  | "course.assign"
  | "bulk.delete"
  | "admin.mutation"
  | "cora.confirm"

/**
 * Desktop-only compatibility shim. Older desktop routes called this (request-scoped,
 * writes to the platform activity log) before this file adopted web's institution-scoped
 * `recordSecurityAuditEvent`. No current caller uses it — kept only so `lib/security/index.ts`'s
 * barrel export keeps resolving. Prefer `recordSecurityAuditEvent` for new code.
 */
export async function logSecurityEvent(
  request: NextRequest | null,
  input: {
    action: LegacySecurityAuditAction | string
    actorType: "admin" | "instructor" | "student" | "cora" | "system"
    actorId?: number | string | null
    resourceType?: string
    resourceId?: number | string | null
    success?: boolean
    summary: string
  },
): Promise<void> {
  try {
    if (request) {
      await logPlatformActivityFromRequest(request, {
        portal: input.actorType === "admin" ? "admin" : input.actorType === "instructor" ? "faculty" : "student",
        actorType: input.actorType === "cora" ? "system" : input.actorType,
        actorId: input.actorId != null ? Number(input.actorId) : undefined,
        action: input.action,
        category: "admin",
        success: input.success !== false,
        summary: input.summary.slice(0, 400),
        metadata: {
          resourceType: input.resourceType,
          resourceId: input.resourceId != null ? String(input.resourceId) : undefined,
        },
      })
    }
  } catch {
    /* audit must never fail the mutation */
  }
}
