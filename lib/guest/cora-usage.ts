import type { GuestCapability, GuestPlan } from "@/lib/guest/types"
import { getGuestAccessPlan } from "@/lib/guest/membership-config"

/** Basic recommendation brief assistance never consumes Cora Credits. */
export function isGuestBriefAssistanceMessage(message: string): boolean {
  const t = message.toLowerCase()
  return (
    /\b(recommendation|brief|recommender|faculty brief|preparation brief|highlight)\b/.test(t) ||
    /\bprepare\b.{0,40}\b(instructor|professor|faculty)\b/.test(t)
  )
}

export function isGuestCareerDiscoveryMessage(message: string): boolean {
  const t = message.toLowerCase()
  return /\b(résumé|resume|cv|cover letter|application|interview|match|career|job|internship|graduate|scholarship|statement|sop|ats)\b/.test(
    t,
  )
}

export function guestCoraChatAllowed(args: {
  capabilities: readonly GuestCapability[]
  message: string
}): { allowed: boolean; reason?: string; creditFree: boolean } {
  const hasCareer = args.capabilities.includes("career.cora")
  const hasBrief = args.capabilities.includes("cora.generateRecommendationBrief")

  if (hasCareer) {
    return { allowed: true, creditFree: isGuestBriefAssistanceMessage(args.message) && hasBrief }
  }

  if (hasBrief && isGuestBriefAssistanceMessage(args.message)) {
    return { allowed: true, creditFree: true }
  }

  if (isGuestCareerDiscoveryMessage(args.message)) {
    return {
      allowed: true,
      creditFree: false,
    }
  }

  return {
    allowed: false,
    reason:
      "Cora Career unlocks full AI career tools. You can still run free scans on Résumé Match and Cover Letter pages, or ask about recommendation briefs.",
    creditFree: false,
  }
}

export function guestPlanLabel(plan: GuestPlan): string {
  return getGuestAccessPlan(plan).displayName
}
