import type { GuestCapability, GuestPlan } from "@/lib/guest/types"

/** Capabilities included in Guest Free — recommendations are permanently free. */
export const GUEST_FREE_CAPABILITIES: readonly GuestCapability[] = [
  "recommendations.request",
  "recommendations.track",
  "recommendations.materials",
  "messages.use",
  "cora.generateRecommendationBrief",
] as const

/** Cora Career Essentials — core lifetime tools + starter credit pool. */
export const CORA_CAREER_ESSENTIALS_CAPABILITIES: readonly GuestCapability[] = [
  "career.resume",
  "career.application",
  "career.cora",
  "career.documents",
  "cora.reviewResume",
  "cora.helpApplication",
] as const

/** Cora Career Lifetime add-ons (interview & advanced prep). */
export const CORA_CAREER_LIFETIME_EXTRA_CAPABILITIES: readonly GuestCapability[] = [
  "career.interview",
  "cora.prepareInterview",
] as const

/** Full Cora Career paid stack. */
export const CORA_CAREER_CAPABILITIES: readonly GuestCapability[] = [
  ...CORA_CAREER_ESSENTIALS_CAPABILITIES,
  ...CORA_CAREER_LIFETIME_EXTRA_CAPABILITIES,
] as const

const PLAN_CAPABILITIES: Record<GuestPlan, readonly GuestCapability[]> = {
  guest_free: GUEST_FREE_CAPABILITIES,
  cora_career_essentials: [...GUEST_FREE_CAPABILITIES, ...CORA_CAREER_ESSENTIALS_CAPABILITIES],
  cora_career: [...GUEST_FREE_CAPABILITIES, ...CORA_CAREER_CAPABILITIES],
}

export function capabilitiesForGuestPlan(plan: GuestPlan): GuestCapability[] {
  return [...(PLAN_CAPABILITIES[plan] ?? GUEST_FREE_CAPABILITIES)]
}

export function guestHasCapability(
  capabilities: readonly GuestCapability[],
  required: GuestCapability,
): boolean {
  return capabilities.includes(required)
}

export function guestNavModules(capabilities: readonly GuestCapability[]) {
  return {
    home: true,
    recommendations: guestHasCapability(capabilities, "recommendations.request"),
    career: guestHasCapability(capabilities, "career.cora"),
    messages: guestHasCapability(capabilities, "messages.use"),
    settings: true,
  }
}
