import { type NextRequest } from "next/server"

/**
 * Cursor automation + remediation scripts: shared secret or configured x-admin-id.
 * Does not grant general admin API access — only system-log / remediation routes that call this.
 */
export function resolveRemediationAutomationActor(
  request: NextRequest,
): { ok: true; actorId: string } | { ok: false } {
  const secret = process.env.REMEDIATION_AGENT_SECRET?.trim()
  const headerSecret = request.headers.get("x-remediation-secret")?.trim()
  if (secret && headerSecret && headerSecret === secret) {
    return { ok: true, actorId: "cursor-automation" }
  }

  const expectedAdminId = process.env.REMEDIATION_ADMIN_ID?.trim() ?? "1"
  const headerAdminId = request.headers.get("x-admin-id")?.trim()
  if (headerAdminId && headerAdminId === expectedAdminId) {
    return { ok: true, actorId: `admin:${headerAdminId}` }
  }

  return { ok: false }
}
