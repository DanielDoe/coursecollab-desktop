import { type NextRequest, NextResponse } from "next/server"
import { ensureInstructorMembershipSchema } from "@/lib/ensure-instructor-membership-schema"
import { getInstructorMembership } from "@/lib/instructor-membership"
import { INSTRUCTOR_MEMBERSHIP_PLANS } from "@/lib/instructor-membership-constants"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    await ensureInstructorMembershipSchema()
    const membership = await getInstructorMembership(parseInt(instructorId, 10))
    if (!membership) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    const plan = INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === membership.tier)

    let institutionalAccess = null
    let effectiveFeatureTier: string = membership.tier
    try {
      const { getEffectiveInstructorAccess } = await import("@/lib/entitlements/resolver")
      const { INSTITUTION_SPONSORED_INSTRUCTOR_TIER } = await import("@/lib/entitlements/feature-bundles")
      const access = await getEffectiveInstructorAccess(membership.instructorId)
      if (access.institutionalEntitlement === "institution_instructor_access") {
        effectiveFeatureTier = INSTITUTION_SPONSORED_INSTRUCTOR_TIER
        institutionalAccess = {
          active: true,
          providedBy: access.providedBy,
          expiresAt: access.expiresAt,
          personalTier: access.personalTier,
          sponsoredFeatureTier: INSTITUTION_SPONSORED_INSTRUCTOR_TIER,
        }
      }
    } catch {
      /* optional */
    }

    const effectivePlan =
      institutionalAccess?.active
        ? INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === effectiveFeatureTier) ?? plan
        : plan

    return NextResponse.json({
      membership: {
        tier: membership.tier,
        effectiveFeatureTier,
        plan: membership.membership?.plan ?? membership.tier,
        status: membership.membership?.status ?? "active",
        billingCadence: membership.membership?.billingCadence ?? null,
        expiresAt: membership.membership?.expiresAt?.toISOString() ?? null,
        stripeCustomerId: membership.stripeCustomerId,
      },
      plan: effectivePlan,
      billing: {
        availableCadences: ["semester", "annual"] as const,
        defaultCadence: "semester" as const,
      },
      institutionalAccess,
    })
  } catch (error) {
    console.error("[instructor/membership GET]", error)
    return NextResponse.json({ error: "Failed to load membership" }, { status: 500 })
  }
}
