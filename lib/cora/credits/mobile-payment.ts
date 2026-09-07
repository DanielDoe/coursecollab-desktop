import { sql } from "@/lib/db"
import { getCoraPack, type CoraCreditPack } from "@/lib/cora/credits/packs"
import {
  createMembershipCustomerSession,
  ensureInstructorStripeCustomer,
  ensureStudentStripeCustomer,
  getStripePublishableKey,
} from "@/lib/membership-mobile-payment"

export type CoraPackMobileCheckout = {
  pack: CoraCreditPack
  customerId: string
  email: string
  amountCents: number
  currency: "usd"
  audience: "student" | "instructor"
  buyerId: number
}

export async function resolveStudentCoraPackCheckout(
  studentId: number,
  packId: string,
): Promise<
  | { ok: true; checkout: CoraPackMobileCheckout }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  const pack = getCoraPack(packId)
  if (!pack || pack.audience !== "student") {
    return { ok: false, status: 400, error: "Invalid Cora Credit Pack" }
  }

  const customer = await ensureStudentStripeCustomer(studentId)
  if (!customer.ok) {
    return {
      ok: false,
      status: customer.status,
      error: customer.error,
      needsEmail: customer.needsEmail,
    }
  }

  return {
    ok: true,
    checkout: {
      pack,
      customerId: customer.customerId,
      email: customer.email,
      amountCents: pack.priceInCents,
      currency: "usd",
      audience: "student",
      buyerId: studentId,
    },
  }
}

export async function resolveInstructorCoraPackCheckout(
  instructorId: number,
  packId: string,
): Promise<
  | { ok: true; checkout: CoraPackMobileCheckout }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  const pack = getCoraPack(packId)
  if (!pack || pack.audience !== "instructor") {
    return { ok: false, status: 400, error: "Invalid Cora Credit Pack" }
  }

  const customer = await ensureInstructorStripeCustomer(instructorId)
  if (!customer.ok) {
    return {
      ok: false,
      status: customer.status,
      error: customer.error,
      needsEmail: customer.needsEmail,
    }
  }

  return {
    ok: true,
    checkout: {
      pack,
      customerId: customer.customerId,
      email: customer.email,
      amountCents: pack.priceInCents,
      currency: "usd",
      audience: "instructor",
      buyerId: instructorId,
    },
  }
}

export async function buildCoraPackPaymentSheetPayload(checkout: CoraPackMobileCheckout) {
  const publishableKey = getStripePublishableKey()
  if (!publishableKey) {
    return { ok: false as const, status: 503, error: "Payment processing is not configured." }
  }
  const customerSessionClientSecret = await createMembershipCustomerSession(checkout.customerId)
  return {
    ok: true as const,
    payload: {
      publishableKey,
      customerId: checkout.customerId,
      customerSessionClientSecret,
      amountCents: checkout.amountCents,
      currency: checkout.currency,
      tier: checkout.pack.name,
      billingCadence: "one_time",
      packId: checkout.pack.id,
      credits: checkout.pack.credits,
      merchantDisplayName: "CourseCollab",
      merchantCountryCode: "US",
    },
  }
}

export async function resolveStudentMembershipTierForBuyer(
  studentId: number,
): Promise<"Scholar" | "Explorer" | "Trailblazer" | undefined> {
  try {
    const { getEffectiveMembershipTier } = await import("@/lib/membership")
    const tier = await getEffectiveMembershipTier(studentId)
    if (tier === "Explorer" || tier === "Trailblazer" || tier === "Scholar") return tier
  } catch {
    /* ignore */
  }
  return undefined
}

/** Optional: keep full_name lookups consistent if a route still selects student name. */
export async function loadStudentDisplayName(studentId: number): Promise<string | null> {
  const rows = (await sql`
    SELECT full_name FROM students WHERE id = ${studentId} LIMIT 1
  `) as Array<{ full_name: string | null }>
  return rows[0]?.full_name ?? null
}
