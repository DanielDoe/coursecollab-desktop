import { type NextRequest, NextResponse } from "next/server"
import { getPlaygroundCredits, getEffectiveMembershipTier } from "@/lib/membership"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const bound = await requireBoundStudentCaller(request, studentId)
    if (!bound.ok) return bound.response

    const studentDatabaseId = bound.studentDbId
    const effectiveTier = await getEffectiveMembershipTier(studentDatabaseId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === effectiveTier)
    const creditsLimit = plan?.features.playgroundCredits
    const currentCredits = await getPlaygroundCredits(studentDatabaseId)

    const isUnlimitedCredits = creditsLimit === "unlimited" || currentCredits >= 999999

    return NextResponse.json({
      credits: isUnlimitedCredits ? 0 : currentCredits,
      tier: effectiveTier,
      creditsLimit: creditsLimit === "unlimited" ? "unlimited" : creditsLimit,
      isUnlimited: isUnlimitedCredits,
    })
  } catch (error) {
    console.error("[playground credits GET]", error)
    return NextResponse.json({ error: "Failed to fetch playground credits" }, { status: 500 })
  }
}
