import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { buildAdminCoraSession } from "@/lib/cora/security"
import { confirmCoraActionProposal } from "@/lib/cora/confirmations/confirm-action"
import type { CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/cora/actions/confirm
 * Execute a signed Admin Cora action proposal after explicit UI confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const adminId = Number.parseInt(String(auth.adminId), 10)
    if (!Number.isFinite(adminId) || adminId <= 0) {
      return NextResponse.json({ error: "Invalid admin session" }, { status: 401 })
    }

    const body = (await request.json()) as {
      proposal?: CoraActionProposal
      institutionId?: number | null
    }
    if (!body.proposal?.actionId || !body.proposal?.hash) {
      return NextResponse.json({ error: "proposal required" }, { status: 400 })
    }

    const session = await buildAdminCoraSession({
      adminId,
      institutionId:
        body.institutionId != null && Number.isFinite(Number(body.institutionId))
          ? Number(body.institutionId)
          : null,
    })

    const result = await confirmCoraActionProposal({
      session,
      proposal: body.proposal,
      courseId: null,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 403 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[admin/cora/actions/confirm]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 },
    )
  }
}
