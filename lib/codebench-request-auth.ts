import { type NextRequest, NextResponse } from "next/server"
import { getEffectiveMembershipTier, isBetaUser } from "@/lib/membership"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export async function requireCodebenchStudent(
  request: NextRequest,
  claimedStudentId?: string | null,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const caller = await requireBoundStudentCaller(request, claimedStudentId)
  if (!caller.ok) return caller

  const isBeta = await isBetaUser(caller.studentDbId)
  if (!isBeta) {
    const effectiveTier = await getEffectiveMembershipTier(caller.studentDbId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === effectiveTier)
    if (!plan?.features.codeBench) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "Trailblazer membership required",
            accessDenied: true,
          },
          { status: 403 },
        ),
      }
    }
  }

  return { ok: true, studentDbId: caller.studentDbId }
}
