import { createHash, randomBytes } from "node:crypto"
import { sql } from "@/lib/db"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"
import type {
  AccessAccountType,
  InvitationApprovalBehavior,
  AccessScopeType,
} from "@/lib/access-governance/types"

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url")
}

export type CreateInvitationInput = {
  createdBy: number
  universityId?: number | null
  scopeType: AccessScopeType
  courseId?: number | null
  sessionId?: number | null
  campId?: number | null
  allowedAccountType: AccessAccountType
  approvalBehavior?: InvitationApprovalBehavior
  expiresAt?: Date | null
  maxUses?: number
  metadata?: Record<string, unknown>
}

export async function createAccessInvitation(
  input: CreateInvitationInput,
): Promise<{ invitationId: number; token: string }> {
  await ensureAccessGovernanceSchema()
  const token = generateInvitationToken()
  const tokenHash = hashInvitationToken(token)

  const [row] = (await sql`
    INSERT INTO access_invitations (
      token_hash, created_by, university_id, scope_type,
      course_id, session_id, camp_id, allowed_account_type,
      approval_behavior, expires_at, max_uses, metadata
    )
    VALUES (
      ${tokenHash},
      ${input.createdBy},
      ${input.universityId ?? null},
      ${input.scopeType},
      ${input.courseId ?? null},
      ${input.sessionId ?? null},
      ${input.campId ?? null},
      ${input.allowedAccountType},
      ${input.approvalBehavior ?? "require_faculty_approval"},
      ${input.expiresAt ?? null},
      ${input.maxUses ?? 1},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id
  `) as { id: number }[]

  return { invitationId: row.id, token }
}

export type ValidatedInvitation = {
  id: number
  allowedAccountType: AccessAccountType
  approvalBehavior: InvitationApprovalBehavior
  courseId: number | null
  sessionId: number | null
  campId: number | null
  universityId: number | null
  scopeType: AccessScopeType
  createdBy: number | null
}

export async function validateAccessInvitation(
  token: string,
  expectedAccountType?: AccessAccountType,
): Promise<{ ok: true; invitation: ValidatedInvitation } | { ok: false; reason: string }> {
  await ensureAccessGovernanceSchema()
  const tokenHash = hashInvitationToken(token.trim())

  const [inv] = (await sql`
    SELECT *
    FROM access_invitations
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `) as Array<Record<string, unknown>>

  if (!inv) return { ok: false, reason: "Invalid invitation." }
  if (String(inv.status) !== "active") return { ok: false, reason: "Invitation is not active." }
  if (inv.expires_at && new Date(String(inv.expires_at)) < new Date()) {
    return { ok: false, reason: "Invitation has expired." }
  }
  const maxUses = Number(inv.max_uses ?? 1)
  const currentUses = Number(inv.current_uses ?? 0)
  if (currentUses >= maxUses) return { ok: false, reason: "Invitation has reached its use limit." }

  const allowed = String(inv.allowed_account_type) as AccessAccountType
  if (expectedAccountType && allowed !== expectedAccountType) {
    return { ok: false, reason: "Invitation account type mismatch." }
  }

  return {
    ok: true,
    invitation: {
      id: Number(inv.id),
      allowedAccountType: allowed,
      approvalBehavior: String(inv.approval_behavior) as InvitationApprovalBehavior,
      courseId: inv.course_id != null ? Number(inv.course_id) : null,
      sessionId: inv.session_id != null ? Number(inv.session_id) : null,
      campId: inv.camp_id != null ? Number(inv.camp_id) : null,
      universityId: inv.university_id != null ? Number(inv.university_id) : null,
      scopeType: String(inv.scope_type) as AccessScopeType,
      createdBy: inv.created_by != null ? Number(inv.created_by) : null,
    },
  }
}

export async function consumeAccessInvitation(invitationId: number): Promise<void> {
  await sql`
    UPDATE access_invitations
    SET current_uses = current_uses + 1,
        updated_at = NOW(),
        status = CASE WHEN current_uses + 1 >= max_uses THEN 'exhausted' ELSE status END
    WHERE id = ${invitationId}
  `
}

export async function revokeAccessInvitation(invitationId: number, revokedBy: number): Promise<void> {
  await sql`
    UPDATE access_invitations
    SET status = 'revoked', updated_at = NOW(),
        metadata = metadata || ${JSON.stringify({ revokedBy })}::jsonb
    WHERE id = ${invitationId} AND status = 'active'
  `
}
