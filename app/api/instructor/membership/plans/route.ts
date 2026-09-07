import { type NextRequest, NextResponse } from "next/server"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  instructorAnnualSavingsCents,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"
import { stripe, STRIPE_INSTRUCTOR_PRODUCTS } from "@/lib/stripe"

export const runtime = "nodejs"

async function stripePriceCents(priceId: string | undefined): Promise<number | null> {
  const id = (priceId ?? "").trim()
  if (!stripe || !id.startsWith("price_")) return null
  try {
    const price = await stripe.prices.retrieve(id)
    return typeof price.unit_amount === "number" ? price.unit_amount : null
  } catch (error) {
    console.warn("[instructor/membership/plans] Stripe price lookup failed:", id, error)
    return null
  }
}

export async function GET(_request: NextRequest) {
  try {
    const [proSemester, proAnnual, teamsSemester, teamsAnnual] = await Promise.all([
      stripePriceCents(STRIPE_INSTRUCTOR_PRODUCTS.Pro_Semester),
      stripePriceCents(STRIPE_INSTRUCTOR_PRODUCTS.Pro_Annual),
      stripePriceCents(STRIPE_INSTRUCTOR_PRODUCTS.Teams_Semester),
      stripePriceCents(STRIPE_INSTRUCTOR_PRODUCTS.Teams_Annual),
    ])

    const stripePrices: Partial<Record<InstructorMembershipTier, { semester?: number; annual?: number }>> = {
      Pro: {
        semester: proSemester ?? undefined,
        annual: proAnnual ?? undefined,
      },
      Teams: {
        semester: teamsSemester ?? undefined,
        annual: teamsAnnual ?? undefined,
      },
    }

    const plans = INSTRUCTOR_MEMBERSHIP_PLANS.map((plan) => {
      const live = stripePrices[plan.id]
      const semesterPriceCents = live?.semester ?? plan.semesterPriceInCents
      const annualPriceCents = live?.annual ?? plan.annualPriceInCents
      const withLivePrices = {
        ...plan,
        semesterPriceInCents: semesterPriceCents,
        annualPriceInCents: annualPriceCents,
      }
      return {
        ...withLivePrices,
        annualSavingsCents: instructorAnnualSavingsCents(withLivePrices),
        priceSource: live?.semester || live?.annual ? ("stripe" as const) : ("constants" as const),
      }
    })

    return NextResponse.json({
      plans,
      billing: {
        availableCadences: ["semester", "annual"] as const,
        defaultCadence: "semester" as const,
      },
    })
  } catch (error) {
    console.error("[instructor/membership/plans]", error)
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 })
  }
}
