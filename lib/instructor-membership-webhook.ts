import { sql } from "@/lib/db"
import {
  getInstructorMembershipExpiry,
  upsertInstructorMembership,
} from "@/lib/instructor-membership"
import type { InstructorBillingCadence, InstructorMembershipTier } from "@/lib/instructor-membership-constants"
import { normalizeInstructorMembershipTier } from "@/lib/instructor-membership-constants"
import { stripe } from "@/lib/stripe"
import type Stripe from "stripe"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"

function parseInstructorPlanId(raw: string | undefined): InstructorMembershipTier | null {
  return normalizeInstructorMembershipTier(raw)
}

function parseCadence(raw: string | undefined): InstructorBillingCadence {
  return raw === "annual" ? "annual" : "semester"
}

async function resolvePaymentAmountCents(
  session: Stripe.Checkout.Session,
  planId: InstructorMembershipTier,
  cadence: InstructorBillingCadence,
): Promise<number> {
  if (!stripe) return 0
  try {
    const sessionDetails = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    })
    if (sessionDetails.amount_total != null) return sessionDetails.amount_total
    const lineItem = sessionDetails.line_items?.data?.[0]
    if (lineItem?.amount_total != null) return lineItem.amount_total
  } catch (error) {
    console.error("[Instructor Webhook] Failed to retrieve payment amount:", error)
  }

  const defaults: Record<InstructorMembershipTier, Record<InstructorBillingCadence, number>> = {
    Free: { semester: 0, annual: 0 },
    Pro: { semester: 9900, annual: 24900 },
    Teams: { semester: 19900, annual: 49900 },
  }
  return defaults[planId]?.[cadence] ?? 0
}

export async function handleInstructorCheckoutCompleted(session: Stripe.Checkout.Session) {
  const instructorIdRaw = session.metadata?.instructorId
  const planId = parseInstructorPlanId(session.metadata?.planId)
  const billingCadence = parseCadence(session.metadata?.billingCadence)

  console.log("[Instructor Webhook] checkout.session.completed:", {
    sessionId: session.id,
    instructorId: instructorIdRaw,
    planId,
    billingCadence,
    metadata: session.metadata,
  })

  if (!instructorIdRaw || !planId || planId === "Free") {
    console.error("[Instructor Webhook] Missing or invalid metadata", session.metadata)
    return
  }

  const instructorId = Number.parseInt(instructorIdRaw, 10)
  if (!Number.isFinite(instructorId)) return

  const expiresAt = await getInstructorMembershipExpiry(billingCadence)
  const finalTier = await upsertInstructorMembership({
    instructorId,
    tier: planId,
    stripeCustomerId: (session.customer as string | null) ?? null,
    stripeCheckoutSessionId: session.id,
    billingCadence,
    expiresAt,
  })

  const paymentAmountCents = await resolvePaymentAmountCents(session, planId, billingCadence)

  try {
    const instructorRow = await sql`
      SELECT name, email FROM instructors WHERE id = ${instructorId} LIMIT 1
    `
    if (instructorRow[0]?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
      const { sendEmail } = await import("@/lib/email/sendEmail")
      await sendEmail("payment_success", instructorRow[0].email as string, {
        name: (instructorRow[0].name as string) || "Instructor",
        amount: (paymentAmountCents / 100).toFixed(2),
        description: `${finalTier} instructor license (${billingCadence === "annual" ? "Annual" : "Semester"})`,
        link: `${baseUrl}${FACULTY_MEMBERSHIP_HREF}`,
      })
    }
  } catch (emailErr) {
    console.warn("[Instructor Webhook] Payment success email failed:", emailErr)
  }

  console.log(`[Instructor Webhook] ✅ Activated ${finalTier} for instructor ${instructorId}`)
}

export async function handleInstructorPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const instructorIdRaw = paymentIntent.metadata?.instructorId
  const planId = parseInstructorPlanId(paymentIntent.metadata?.planId)
  const billingCadence = parseCadence(paymentIntent.metadata?.billingCadence)

  if (!instructorIdRaw || !planId || planId === "Free") {
    console.error("[Instructor Webhook] Missing metadata on payment_intent.succeeded", paymentIntent.metadata)
    return
  }

  const instructorId = Number.parseInt(instructorIdRaw, 10)
  if (!Number.isFinite(instructorId)) return

  const expiresAt = await getInstructorMembershipExpiry(billingCadence)
  await upsertInstructorMembership({
    instructorId,
    tier: planId,
    stripeCustomerId: (paymentIntent.customer as string | null) ?? null,
    billingCadence,
    expiresAt,
  })

  console.log(
    `[Instructor Webhook] ✅ payment_intent.succeeded instructor ${instructorId} → ${planId} (${billingCadence})`,
  )
}

export async function handleInstructorMembershipPaymentFailed(
  session: Stripe.Checkout.Session,
  errorMessage: string,
) {
  const instructorIdRaw = session.metadata?.instructorId
  if (!instructorIdRaw) return

  console.warn(
    `[Instructor Webhook] Membership payment failed for instructor ${instructorIdRaw}: ${errorMessage}`,
  )
}
