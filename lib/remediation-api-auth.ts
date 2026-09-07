import { type NextRequest, NextResponse } from "next/server"
import { resolveRemediationAutomationActor } from "@/lib/remediation-automation-auth"
import { requireSystemLogAccess } from "@/lib/system-log-auth"

/**
 * Admin/instructor session OR shared agent secret for Cursor automation callbacks.
 * Set REMEDIATION_AGENT_SECRET in Vercel env for the automation to call resolve/scan APIs.
 */
export async function requireRemediationAccess(
  request: NextRequest,
): Promise<{ ok: true; actorId: string } | { ok: false; response: NextResponse }> {
  const automation = resolveRemediationAutomationActor(request)
  if (automation.ok) {
    return { ok: true, actorId: automation.actorId }
  }

  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth
  return { ok: true, actorId: auth.actor.actorId }
}
