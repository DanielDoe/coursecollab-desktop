import { deductGuestCoraCredits, getGuestCoraBalance } from "@/lib/guest/cora-credit-ledger"
import {
  type GuestCareerAiFeature,
  guestCareerAiCreditCost,
} from "@/lib/guest/career/guest-ai-credit-costs"

export type { GuestCareerAiFeature } from "@/lib/guest/career/guest-ai-credit-costs"
export {
  GUEST_CAREER_AI_FEATURE_COSTS,
  GUEST_RESUME_MATCH_CREDIT_COST,
  guestCareerAiCreditCost,
} from "@/lib/guest/career/guest-ai-credit-costs"

export type GuestAiCreditGate =
  | { ok: true; cost: number }
  | {
      ok: false
      status: number
      body: Record<string, unknown>
      message: string
    }

export async function gateGuestAiCredits(
  guestId: number,
  feature: GuestCareerAiFeature,
): Promise<GuestAiCreditGate> {
  const cost = guestCareerAiCreditCost(feature)
  if (cost <= 0) return { ok: true, cost: 0 }

  const balance = await getGuestCoraBalance(guestId)
  if (balance.available < cost) {
    const label = feature.replace(/_/g, " ")
    return {
      ok: false,
      status: 402,
      message: `Not enough Cora Credits for ${label} (${cost} required). Top up to continue.`,
      body: {
        error: `Not enough Cora Credits for ${label} (${cost} required). Top up to continue.`,
        needsCredits: true,
        creditCost: cost,
        creditsAvailable: balance.available,
        feature,
        topUpUrl: "/guest/cora-credits",
      },
    }
  }

  return { ok: true, cost }
}

export async function chargeGuestAiCredits(
  guestId: number,
  feature: GuestCareerAiFeature,
  description?: string,
): Promise<{ creditsCharged: number; creditsRemaining: number }> {
  const cost = guestCareerAiCreditCost(feature)
  if (cost <= 0) {
    const bal = await getGuestCoraBalance(guestId)
    return { creditsCharged: 0, creditsRemaining: bal.available }
  }

  const deducted = await deductGuestCoraCredits(
    guestId,
    cost,
    description ?? `Guest career AI: ${feature.replace(/_/g, " ")}`,
    `guest_${feature}`,
  )
  if (!deducted.ok) {
    throw new Error(`Credit deduction failed for ${feature}`)
  }

  return { creditsCharged: cost, creditsRemaining: deducted.remaining }
}

export async function requireGuestAiCreditsOrThrow(
  guestId: number,
  feature: GuestCareerAiFeature,
): Promise<number> {
  const gate = await gateGuestAiCredits(guestId, feature)
  if (!gate.ok) throw new Error(gate.message)
  return gate.cost
}
