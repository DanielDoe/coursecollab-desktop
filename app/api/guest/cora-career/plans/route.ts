import { NextResponse } from "next/server"
import {
  GUEST_CORA_CREDIT_PACKS,
  formatGuestAccessPrice,
  listGuestAccessPlans,
} from "@/lib/guest/membership-config"
import { getGuestFeatureFlags } from "@/lib/guest/feature-flags"

export const dynamic = "force-dynamic"

export async function GET() {
  const flags = getGuestFeatureFlags()
  const plans = listGuestAccessPlans().map((p) => ({
    id: p.id,
    name: p.displayName,
    priceLabel: formatGuestAccessPrice(p.id),
    priceUsd: p.priceUsd,
    lifetime: p.lifetime,
    coraCreditsIncluded: p.coraCreditsIncluded,
    features: p.marketingFeatures,
    popular: p.popular ?? false,
  }))

  return NextResponse.json({
    plans,
    creditPacks: GUEST_CORA_CREDIT_PACKS,
    flags,
    checkoutEnabled: flags.guestMembershipEnabled && flags.coraCareerEnabled,
  })
}
