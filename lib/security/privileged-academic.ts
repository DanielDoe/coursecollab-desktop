import { NextResponse, type NextRequest } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { withPlatformPrivilegedDbContext } from "@/lib/db-tenant-context"
import { SECURITY_AUDIT_ACTIONS } from "@/lib/security/actions"
import { recordSecurityAuditEvent, requestAuditMeta } from "@/lib/security/audit"
import {
  readPrivilegedReasonFromRequest,
  type PrivilegedDbContext,
} from "@/lib/security/privileged-context"

export async function verifyInstitutionExists(institutionId: number): Promise<boolean> {
  const id = Math.trunc(Number(institutionId))
  if (!Number.isInteger(id) || id < 1) return false
  const rows = (await withPlatformPrivilegedDbContext(
    {
      reasonCode: "maintenance",
      operation: "verify_institution_exists",
      institutionId: id,
      resourceType: "institution",
      resourceId: id,
      audit: false,
    },
    async () =>
      sql`SELECT id FROM universities WHERE id = ${id} LIMIT 1`,
  )) as { id: number }[]
  return rows.length > 0
}

/**
 * Platform operator access to identifiable academic data.
 * Actor, institution, and resource are server-derived. Client may supply reasonCode only.
 */
export async function requirePlatformPrivilegedAcademicAccess(
  request: NextRequest,
  opts: {
    operation: string
    institutionId?: number | null
    resourceType?: string | null
    resourceId?: string | number | null
    action?: string
  },
): Promise<
  | { ok: true; adminId: number; context: PrivilegedDbContext }
  | { ok: false; response: NextResponse }
> {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin

  const claimed = readPrivilegedReasonFromRequest(request)
  if (!claimed.reasonCode) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Privileged academic access requires a reasonCode" },
        { status: 403 },
      ),
    }
  }

  let institutionId = opts.institutionId ?? null
  if (institutionId != null && !(await verifyInstitutionExists(institutionId))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Institution not found" }, { status: 404 }),
    }
  }

  const adminId = Number(admin.adminId)
  const context: PrivilegedDbContext = {
    reasonCode: claimed.reasonCode,
    operation: opts.operation,
    institutionId,
    resourceType: opts.resourceType ?? null,
    resourceId: opts.resourceId ?? null,
    ticketReference: claimed.ticketReference,
    explanation: claimed.explanation,
    actorType: "platform_admin",
    actorId: adminId,
    failClosed: true,
    audit: true,
  }

  const reqMeta = requestAuditMeta(request)
  await recordSecurityAuditEvent({
    actorType: "platform_admin",
    actorId: adminId,
    institutionId,
    action: opts.action ?? SECURITY_AUDIT_ACTIONS.PLATFORM_PRIVILEGED_ACCESS,
    resourceType: opts.resourceType ?? null,
    resourceId: opts.resourceId ?? null,
    result: "success",
    reasonCode: claimed.reasonCode,
    eventScope: "platform",
    failClosed: true,
    ...reqMeta,
    metadata: {
      operation: opts.operation,
      ticketReference: claimed.ticketReference,
    },
  })

  return { ok: true, adminId, context }
}
