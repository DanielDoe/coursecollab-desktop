import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { normalizeGuestOnboardingPurpose, guestOnboardingPurposeLabel } from "@/lib/guest/onboarding"
import { guestNavModules } from "@/lib/guest/capabilities"
import { getGuestFeatureFlags } from "@/lib/guest/feature-flags"
import { getGuestAccessPlan, formatGuestAccessPrice, guestPlanHasCareerUnlock } from "@/lib/guest/membership-config"
import { getGuestCoraBalance } from "@/lib/guest/cora-credit-ledger"

export const dynamic = "force-dynamic"

/** Guest entitlement + capability snapshot for client authorization. */
export async function GET(request: NextRequest) {
  try {
    const raw = (new URL(request.url).searchParams.get("studentDatabaseId") ?? "").trim()
    if (!raw) return NextResponse.json({ error: "student id required" }, { status: 400 })

    const guestId = await requirePlatformGuestDatabaseId(raw)
    if (guestId == null) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const resolved = await resolveGuestCapabilities(guestId)

    const profileRows = await sql`
      SELECT full_name, guest_access_purpose, guest_organization
      FROM students WHERE id = ${guestId} LIMIT 1
    `
    const profile = profileRows[0] as
      | { full_name: string; guest_access_purpose: string | null; guest_organization: string | null }
      | undefined

    const onboardingPurpose = normalizeGuestOnboardingPurpose(profile?.guest_access_purpose)
    const flags = getGuestFeatureFlags()
    const coraCredits = await getGuestCoraBalance(guestId)
    const planConfig = getGuestAccessPlan(resolved.plan)

    return NextResponse.json({
      plan: resolved.plan,
      status: resolved.status,
      coraCareerLifetime: resolved.coraCareerLifetime ?? guestPlanHasCareerUnlock(resolved.plan),
      capabilities: resolved.capabilities,
      nav: guestNavModules(resolved.capabilities),
      onboardingPurpose,
      onboardingLabel: guestOnboardingPurposeLabel(onboardingPurpose),
      organization: profile?.guest_organization ?? "",
      fullName: profile?.full_name ?? "",
      flags,
      planConfig: {
        priceLabel: formatGuestAccessPrice(resolved.plan),
        coraCreditsIncluded: planConfig.coraCreditsIncluded,
        lifetime: planConfig.lifetime,
      },
      coraCredits: {
        available: coraCredits.available,
        balance: coraCredits.balance,
        reserved: coraCredits.reserved,
        isLow: coraCredits.isLow,
        balanceLevel: coraCredits.balanceLevel,
      },
    })
  } catch (e) {
    console.error("[guest/entitlements GET]", e)
    return NextResponse.json({ error: "Failed to load entitlements" }, { status: 500 })
  }
}
