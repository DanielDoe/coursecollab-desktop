import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { resolveRemediationAutomationActor } from "@/lib/remediation-automation-auth"

export type SystemLogActor = {
  role: "admin" | "instructor"
  actorId: string
}

export async function requireSystemLogAccess(
  request: NextRequest,
): Promise<{ ok: true; actor: SystemLogActor } | { ok: false; response: NextResponse }> {
  const automation = resolveRemediationAutomationActor(request)
  if (automation.ok) {
    return { ok: true, actor: { role: "admin", actorId: automation.actorId } }
  }

  const admin = await requireAdminId(request)
  if (admin.ok) {
    return { ok: true, actor: { role: "admin", actorId: admin.adminId } }
  }

  const instructor = await requireInstructorSession(request)
  if (instructor.ok) {
    return { ok: true, actor: { role: "instructor", actorId: String(instructor.instructorId) } }
  }

  return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
}
