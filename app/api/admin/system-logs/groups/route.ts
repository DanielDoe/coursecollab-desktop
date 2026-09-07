import { type NextRequest, NextResponse } from "next/server"
import { requireSystemLogAccess } from "@/lib/system-log-auth"
import { enqueueGroupForRemediation } from "@/lib/ai-remediation-db"
import { querySystemLogGroups, updateSystemLogGroup } from "@/lib/system-log-query"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth.response

  try {
    const params = new URL(request.url).searchParams
    const status = params.get("status")
    const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0)
    const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 25) || 25))
    const { groups, total } = await querySystemLogGroups(status, { offset, limit })
    return NextResponse.json({ groups, total, offset, limit })
  } catch (error) {
    console.error("[admin/system-logs/groups] GET failed", error)
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSystemLogAccess(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const groupId = Number(body.groupId)
    if (!Number.isFinite(groupId)) {
      return NextResponse.json({ error: "groupId required" }, { status: 400 })
    }

    await updateSystemLogGroup(groupId, {
      status: body.status,
      assignedTo: body.assignedTo,
      resolutionNotes: body.resolutionNotes,
      resolvedBy: auth.actor.actorId,
    })

    let remediationEnqueued = false
    if (body.status === "open") {
      remediationEnqueued = await enqueueGroupForRemediation(groupId)
    }

    return NextResponse.json({ ok: true, remediationEnqueued })
  } catch (error) {
    console.error("[admin/system-logs/groups] PATCH failed", error)
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
  }
}
