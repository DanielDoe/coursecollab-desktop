import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { buildStudentCoraSession } from "@/lib/cora/security"
import { confirmCoraActionProposal } from "@/lib/cora/confirmations/confirm-action"
import type { CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"
import { getEffectiveMembershipTier } from "@/lib/membership"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/cora/actions/confirm
 * Execute a signed student Cora action proposal after explicit UI confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { proposal?: CoraActionProposal }
    if (!body.proposal?.actionId || !body.proposal?.hash) {
      return NextResponse.json({ error: "proposal required" }, { status: 400 })
    }

    let membershipTier = null
    try {
      membershipTier = await getEffectiveMembershipTier(auth.studentDbId)
    } catch {
      /* optional */
    }

    const session = await buildStudentCoraSession({
      studentDbId: auth.studentDbId,
      membershipTier,
    })

    const result = await confirmCoraActionProposal({
      session,
      proposal: body.proposal,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 403 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[cora/actions/confirm]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 },
    )
  }
}
