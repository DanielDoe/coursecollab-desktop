import { type NextRequest, NextResponse } from "next/server"
import { MEMBERSHIP_PLANS, studentSemesterOffer, type MembershipTier } from "@/lib/membership-constants"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"
import {
  availableBillingCadences,
  isSemesterOnlyBillingStudent,
} from "@/lib/student-billing-eligibility"
import { sql } from "@/lib/db"
import { getSemesterBillingWindow } from "@/lib/semester-utils"

export const runtime = "nodejs"

async function stripePriceCents(priceId: string | undefined): Promise<number | null> {
  const id = (priceId ?? "").trim()
  if (!stripe || !id.startsWith("price_")) return null
  try {
    const price = await stripe.prices.retrieve(id)
    return typeof price.unit_amount === "number" ? price.unit_amount : null
  } catch (error) {
    console.warn("[membership/plans] Stripe price lookup failed:", id, error)
    return null
  }
}

/** Public plan catalog with live Stripe semester prices (falls back to constants). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    let semesterOnlyBilling = true
    if (studentId) {
      const rows = await sql`
        SELECT COALESCE(is_platform_guest, false) AS is_platform_guest
        FROM students
        WHERE id = ${parseInt(studentId, 10)}
        LIMIT 1
      `
      semesterOnlyBilling = isSemesterOnlyBillingStudent(rows[0]?.is_platform_guest)
    }

    const [explorerStripe, trailblazerStripe] = await Promise.all([
      stripePriceCents(STRIPE_PRODUCTS.Explorer_Semester),
      stripePriceCents(STRIPE_PRODUCTS.Trailblazer_Semester),
    ])

    const plans = MEMBERSHIP_PLANS.map((plan) => {
      const offer = studentSemesterOffer(plan.id)
      const semesterPriceCents = plan.semesterPriceInCents ?? 0
      const live =
        plan.id === "Explorer" ? explorerStripe : plan.id === "Trailblazer" ? trailblazerStripe : null
      const priceSource: "stripe" | "constants" =
        live != null && live === semesterPriceCents ? "stripe" : "constants"

      return {
        id: plan.id as MembershipTier,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        semesterPriceCents,
        listPriceCents: offer?.listCents ?? 0,
        saveCents: offer?.saveCents ?? 0,
        monthlyPriceCents: plan.monthlyPriceInCents ?? plan.priceInCents ?? 0,
        priceSource,
      }
    })

    const cadences = availableBillingCadences(semesterOnlyBilling)
    const semesterWindow = await getSemesterBillingWindow()

    return NextResponse.json({
      plans,
      billing: {
        semesterOnly: semesterOnlyBilling,
        availableCadences: cadences,
        defaultCadence: semesterOnlyBilling ? "semester" : "semester",
      },
      semesterWindow,
      source: plans.some((p) => p.priceSource === "stripe") ? "stripe" : "constants",
    })
  } catch (error) {
    console.error("[membership/plans] Failed:", error)
    return NextResponse.json({ error: "Failed to load membership plans" }, { status: 500 })
  }
}
