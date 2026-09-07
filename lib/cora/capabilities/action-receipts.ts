/**
 * Structured action receipts — returned after every Cora write.
 * Prefer receipts over bare "Done." so faculty/admin can verify + deep-link.
 */

export type CoraActionReceiptStatus =
  | "draft"
  | "published"
  | "scheduled"
  | "completed"
  | "failed"
  | "cancelled"

export type CoraActionReceipt = {
  receiptId: string
  performedBy: "CORA_ON_BEHALF_OF_USER"
  actorUserId: number
  actorRole: "student" | "faculty" | "admin"
  coraSessionId?: string | null
  tool: string
  capability: string
  resourceType: string
  resourceId?: string | number | null
  institutionId?: number | null
  courseId?: number | null
  title: string
  summary: string
  status: CoraActionReceiptStatus
  fields: { label: string; value: string }[]
  links?: { label: string; href: string }[]
  confirmationId?: string | null
  timestamp: string
  previousState?: Record<string, unknown> | null
  newState?: Record<string, unknown> | null
}

export function createActionReceipt(
  input: Omit<CoraActionReceipt, "receiptId" | "performedBy" | "timestamp"> & {
    receiptId?: string
    timestamp?: string
  },
): CoraActionReceipt {
  return {
    receiptId: input.receiptId ?? `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    performedBy: "CORA_ON_BEHALF_OF_USER",
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    coraSessionId: input.coraSessionId ?? null,
    tool: input.tool,
    capability: input.capability,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    institutionId: input.institutionId ?? null,
    courseId: input.courseId ?? null,
    title: input.title,
    summary: input.summary,
    status: input.status,
    fields: input.fields,
    links: input.links,
    confirmationId: input.confirmationId ?? null,
    previousState: input.previousState ?? null,
    newState: input.newState ?? null,
  }
}

/** Markdown-friendly receipt for chat surfaces. */
export function formatActionReceiptMarkdown(receipt: CoraActionReceipt): string {
  const fieldLines = receipt.fields.map((f) => `**${f.label}:** ${f.value}`).join("\n")
  const linkLines =
    receipt.links?.map((l) => `[${l.label}](${l.href})`).join(" · ") ?? ""
  return [
    `### ${receipt.title}`,
    "",
    receipt.summary,
    "",
    fieldLines,
    "",
    `**Status:** ${receipt.status}`,
    linkLines ? `\n${linkLines}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Conceptual audit payload for Admin Audit Logs.
 * Persistence hooks into the existing audit system when available.
 */
export type CoraAuditEntry = {
  actorUserId: number
  actorRole: "student" | "faculty" | "admin"
  coraSessionId?: string | null
  tool: string
  capability: string
  resourceType: string
  resourceId?: string | number | null
  institutionId?: number | null
  courseId?: number | null
  previousState?: Record<string, unknown> | null
  newState?: Record<string, unknown> | null
  confirmationId?: string | null
  timestamp: string
  status: "succeeded" | "failed" | "cancelled"
  performedBy: "CORA_ON_BEHALF_OF_USER"
}

export function receiptToAuditEntry(
  receipt: CoraActionReceipt,
  status: CoraAuditEntry["status"] = "succeeded",
): CoraAuditEntry {
  return {
    actorUserId: receipt.actorUserId,
    actorRole: receipt.actorRole,
    coraSessionId: receipt.coraSessionId,
    tool: receipt.tool,
    capability: receipt.capability,
    resourceType: receipt.resourceType,
    resourceId: receipt.resourceId,
    institutionId: receipt.institutionId,
    courseId: receipt.courseId,
    previousState: receipt.previousState,
    newState: receipt.newState,
    confirmationId: receipt.confirmationId,
    timestamp: receipt.timestamp,
    status,
    performedBy: "CORA_ON_BEHALF_OF_USER",
  }
}
