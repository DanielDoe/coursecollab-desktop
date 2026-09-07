import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getInstitutionPlan, institutionPlanAllowsSelfService } from "@/lib/institution-plans"
import { recordInstitutionAudit } from "@/lib/institutions/audit"
import { createInstitutionLicense } from "@/lib/institutions/licenses"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request, { billing: true })
  if (!auth.ok) return auth.response
  if (!stripe) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 })

  await ensureInstitutionSchema()
  const body = await request.json().catch(() => ({}))
  const plan = getInstitutionPlan(String(body.planId ?? ""))
  if (!plan || !institutionPlanAllowsSelfService(plan.id) || plan.annualPriceCents == null) {
    return NextResponse.json({ error: "This plan requires an institutional quote." }, { status: 400 })
  }

  const origin = request.nextUrl.origin
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.annualPriceCents,
          product_data: {
            name: `CourseCollab ${plan.displayName}`,
            description: `${plan.studentCapacity} active student capacity · 12-month institutional license`,
          },
        },
      },
    ],
    metadata: {
      audience: "institution",
      institutionId: String(auth.session.institutionId),
      planId: plan.id,
    },
    success_url: `${origin}/institution/dashboard/license?checkout=success`,
    cancel_url: `${origin}/institution/dashboard/billing?checkout=cancel`,
  })

  await createInstitutionLicense({
    institutionId: auth.session.institutionId,
    planId: plan.id,
    billingMethod: "stripe",
    contractStatus: "pending_payment",
    status: "pending",
    stripeSessionId: session.id,
    metadata: { checkoutSessionId: session.id },
  })

  await recordInstitutionAudit({
    institutionId: auth.session.institutionId,
    actorUserId: auth.session.userId,
    actorUserType: auth.session.userType,
    action: "billing_method_changed",
    entityType: "institution_license",
    newValue: { planId: plan.id, billingMethod: "stripe", checkoutSessionId: session.id },
  })

  return NextResponse.json({ success: true, redirectUrl: session.url, sessionId: session.id })
}
