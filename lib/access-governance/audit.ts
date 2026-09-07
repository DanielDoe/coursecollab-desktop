import { recordSecurityEvent } from "@/lib/compliance/audit-log"
import type { AccessAccountType, ApprovalSource } from "@/lib/access-governance/types"

export async function auditAccessGovernanceEvent(input: {
  action: "access_request.create" | "access_request.approve" | "access_request.reject" | "invitation.create" | "invitation.revoke" | "invitation.consume"
  actorRole: string
  actorId?: number | string | null
  requestId?: number
  invitationId?: number
  accountType?: AccessAccountType | null
  approvalSource?: ApprovalSource | null
  outcome: "success" | "denied" | "error"
  metadata?: Record<string, unknown>
}): Promise<void> {
  await recordSecurityEvent({
    actorRole: input.actorRole,
    actorId: typeof input.actorId === "string" ? Number.parseInt(input.actorId, 10) || null : input.actorId ?? null,
    action: input.action,
    resourceType: input.requestId != null ? "account_request" : "access_invitation",
    resourceId: input.requestId ?? input.invitationId ?? null,
    outcome: input.outcome,
    metadata: {
      accountType: input.accountType,
      approvalSource: input.approvalSource,
      ...input.metadata,
    },
  })
}
