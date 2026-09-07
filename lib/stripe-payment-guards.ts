import { type NextRequest, NextResponse } from "next/server"
import {
  LEGACY_STUDENT_SEMESTER_PRICE_CENTS,
  MEMBERSHIP_PLANS,
  studentSemesterOffer,
} from "@/lib/membership-constants"
import {
  forbiddenStudentResponse,
  requireCallerStudentDbId,
} from "@/lib/student-api-auth"
import {
  forbiddenInstructorResponse,
  requireInstructorSession,
} from "@/lib/instructor-session-auth"

export function isPaidCheckoutSession(session: {
  payment_status?: string | null
}): boolean {
  return session.payment_status === "paid"
}

export function isSucceededPaymentIntent(intent: { status?: string | null }): boolean {
  return intent.status === "succeeded"
}

export function isPaidMembershipTier(planId: string | null | undefined): planId is "Explorer" | "Trailblazer" {
  return planId === "Explorer" || planId === "Trailblazer"
}

export function authorizedStudentMembershipAmounts(
  tier: "Explorer" | "Trailblazer",
  cadence: "semester" | "monthly",
): Set<number> {
  const allowed = new Set<number>()
  if (cadence === "semester") {
    const offer = studentSemesterOffer(tier)
    if (offer) {
      allowed.add(offer.saleCents)
      allowed.add(offer.listCents)
    }
    allowed.add(LEGACY_STUDENT_SEMESTER_PRICE_CENTS[tier])
  } else {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    if (plan?.monthlyPriceInCents) allowed.add(plan.monthlyPriceInCents)
    if (plan?.priceInCents) allowed.add(plan.priceInCents)
  }
  return allowed
}

export function isAuthorizedStudentMembershipCharge(
  planId: string | null | undefined,
  cadence: "semester" | "monthly" | undefined,
  amountCents: number | null | undefined,
): boolean {
  if (!isPaidMembershipTier(planId)) return false
  if (cadence !== "semester" && cadence !== "monthly") return false
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || amountCents <= 0) {
    return false
  }
  return authorizedStudentMembershipAmounts(planId, cadence).has(Math.round(amountCents))
}

export async function requireBuyerMatchesPaymentCaller(
  request: NextRequest,
  audience: "student" | "instructor",
  buyerId: number,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!Number.isFinite(buyerId) || buyerId <= 0) {
    return { ok: false, response: NextResponse.json({ error: "Invalid buyer" }, { status: 400 }) }
  }

  if (audience === "instructor") {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session
    if (session.instructorId !== buyerId) {
      return { ok: false, response: forbiddenInstructorResponse() }
    }
    return { ok: true }
  }

  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller
  if (caller.studentDbId !== buyerId) {
    return { ok: false, response: forbiddenStudentResponse() }
  }
  return { ok: true }
}

