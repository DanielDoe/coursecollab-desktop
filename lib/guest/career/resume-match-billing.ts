import {
  complimentaryMatchMeta,
  consumeComplimentaryResumeMatch,
  getComplimentaryResumeMatchStatus,
  type ComplimentaryMatchStatus,
} from "@/lib/guest/career/complimentary-matches"
import {
  chargeGuestAiCredits,
  gateGuestAiCredits,
} from "@/lib/guest/career/guest-ai-credits"

export type ResumeMatchBillingMode = "cached" | "complimentary" | "credits"

export type ResumeMatchBillingGate =
  | { allowed: true; mode: ResumeMatchBillingMode }
  | { allowed: false; status: number; body: Record<string, unknown> }

export async function gateGuestResumeMatchBilling(args: {
  guestId: number
  hasFullAccess: boolean
  isCached: boolean
}): Promise<ResumeMatchBillingGate> {
  if (args.isCached) return { allowed: true, mode: "cached" }

  if (args.hasFullAccess) {
    const gate = await gateGuestAiCredits(args.guestId, "resume_match")
    if (!gate.ok) {
      return { allowed: false, status: gate.status, body: gate.body }
    }
    return { allowed: true, mode: "credits" }
  }

  const complimentary = await getComplimentaryResumeMatchStatus(args.guestId)
  if (complimentary.remaining <= 0) {
    return {
      allowed: false,
      status: 403,
      body: {
        error: "Complimentary Resume Match scans used. Unlock Cora Career for full Resume Match.",
        upgradeUrl: "/guest/cora-career/access",
        ...complimentaryMatchMeta(complimentary),
      },
    }
  }

  return { allowed: true, mode: "complimentary" }
}

export type ResumeMatchBillingResult = {
  complimentary?: ComplimentaryMatchStatus
  creditsCharged?: number
  creditsRemaining?: number
}

export async function settleGuestResumeMatchBilling(args: {
  guestId: number
  mode: ResumeMatchBillingMode
}): Promise<ResumeMatchBillingResult> {
  if (args.mode === "cached") return {}

  if (args.mode === "complimentary") {
    const complimentary = await consumeComplimentaryResumeMatch(args.guestId)
    return { complimentary }
  }

  const charged = await chargeGuestAiCredits(args.guestId, "resume_match", "Resume Match analysis")
  return {
    creditsCharged: charged.creditsCharged,
    creditsRemaining: charged.creditsRemaining,
  }
}
