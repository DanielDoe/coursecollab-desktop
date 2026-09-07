import { sql } from "@/lib/db"
import { stripe, STRIPE_PRODUCTS, resolveInstructorStripePriceId } from "@/lib/stripe"
import type { BillingCadence } from "@/lib/membership-constants"
import { normalizeInstructorMembershipTier } from "@/lib/instructor-membership-constants"
import {
  isSemesterOnlyBillingStudent,
  resolveStudentBillingCadence,
} from "@/lib/student-billing-eligibility"

export function getStripePublishableKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    null
  )
}

export async function retrieveStripePriceAmount(
  priceId: string,
): Promise<{ amountCents: number; currency: string } | null> {
  if (!stripe || !priceId.startsWith("price_")) return null
  try {
    const price = await stripe.prices.retrieve(priceId)
    if (typeof price.unit_amount !== "number") return null
    return {
      amountCents: price.unit_amount,
      currency: (price.currency ?? "usd").toLowerCase(),
    }
  } catch (error) {
    console.warn("[membership-mobile-payment] price lookup failed:", priceId, error)
    return null
  }
}

export function resolveStudentMembershipPriceId(
  tier: string,
  cadence: BillingCadence,
): string | null {
  if (cadence === "semester") {
    if (tier === "Explorer") return STRIPE_PRODUCTS.Explorer_Semester
    if (tier === "Trailblazer") return STRIPE_PRODUCTS.Trailblazer_Semester
    return null
  }
  const monthly = STRIPE_PRODUCTS[tier as keyof typeof STRIPE_PRODUCTS]
  return monthly ?? null
}

export async function ensureStudentStripeCustomer(studentId: number): Promise<
  | { ok: true; customerId: string; email: string }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  if (!stripe) {
    return { ok: false, status: 503, error: "Payment processing is not configured." }
  }

  const students = await sql`
    SELECT id, full_name, email, stripe_customer_id
    FROM students
    WHERE id = ${studentId}
    LIMIT 1
  `

  if (students.length === 0) {
    return { ok: false, status: 404, error: "Student not found" }
  }

  const student = students[0]
  if (!student.email || String(student.email).includes("@student.placeholder.edu")) {
    return {
      ok: false,
      status: 400,
      error: "Please add your email address in your profile before purchasing a membership",
      needsEmail: true,
    }
  }

  let customerId = student.stripe_customer_id as string | null
  if (!customerId) {
    const existingCustomers = await stripe.customers.list({
      email: student.email as string,
      limit: 1,
    })
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: student.email as string,
        name: (student.full_name as string) || undefined,
        metadata: { studentId: String(student.id) },
      })
      customerId = customer.id
    }
    await sql`
      UPDATE students
      SET stripe_customer_id = ${customerId}
      WHERE id = ${studentId}
    `
  }

  return { ok: true, customerId, email: student.email as string }
}

export async function ensureInstructorStripeCustomer(instructorId: number): Promise<
  | { ok: true; customerId: string; email: string }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  if (!stripe) {
    return { ok: false, status: 503, error: "Payment processing is not configured." }
  }

  const instructors = await sql`
    SELECT id, name, email, stripe_customer_id
    FROM instructors
    WHERE id = ${instructorId}
    LIMIT 1
  `

  if (instructors.length === 0) {
    return { ok: false, status: 404, error: "Instructor not found" }
  }

  const instructor = instructors[0]
  if (!instructor.email?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Please add your email in profile before purchasing",
      needsEmail: true,
    }
  }

  let customerId = instructor.stripe_customer_id as string | null
  if (!customerId) {
    const existingCustomers = await stripe.customers.list({
      email: instructor.email as string,
      limit: 1,
    })
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: instructor.email as string,
        name: (instructor.name as string) || undefined,
        metadata: { instructorId: String(instructor.id), audience: "instructor" },
      })
      customerId = customer.id
    }
    await sql`
      UPDATE instructors
      SET stripe_customer_id = ${customerId}
      WHERE id = ${instructorId}
    `
  }

  return { ok: true, customerId, email: instructor.email as string }
}

export async function createMembershipCustomerSession(customerId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured")
  const customerSession = await stripe.customerSessions.create({
    customer: customerId,
    components: {
      mobile_payment_element: {
        enabled: true,
        features: {
          payment_method_save: "enabled",
          payment_method_redisplay: "enabled",
          payment_method_remove: "enabled",
        },
      },
    },
  })
  if (!customerSession.client_secret) {
    throw new Error("Customer session client secret missing")
  }
  return customerSession.client_secret
}

export async function resolveStudentMembershipCheckout(
  studentId: number,
  tier: string,
  billingCadence?: "semester" | "monthly",
): Promise<
  | {
      ok: true
      customerId: string
      priceId: string
      amountCents: number
      currency: string
      cadence: BillingCadence
    }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  const studentBillingRows = await sql`
    SELECT COALESCE(is_platform_guest, false) AS is_platform_guest
    FROM students
    WHERE id = ${studentId}
    LIMIT 1
  `
  if (studentBillingRows.length === 0) {
    return { ok: false, status: 404, error: "Student not found" }
  }

  const semesterOnlyBilling = isSemesterOnlyBillingStudent(
    studentBillingRows[0]?.is_platform_guest,
  )
  const cadence = resolveStudentBillingCadence(
    tier,
    billingCadence === "semester"
      ? "semester"
      : billingCadence === "monthly"
        ? "monthly"
        : undefined,
    semesterOnlyBilling,
  )

  if (cadence === "monthly") {
    return {
      ok: false,
      status: 400,
      error: "Monthly billing uses subscription checkout. Use semester billing in the app.",
    }
  }

  const validTiers = ["Explorer", "Trailblazer"]
  if (!validTiers.includes(tier)) {
    return { ok: false, status: 400, error: "Invalid tier for payment" }
  }

  const priceId = resolveStudentMembershipPriceId(tier, cadence)
  if (!priceId?.startsWith("price_") && !priceId?.startsWith("prod_")) {
    return { ok: false, status: 400, error: "Payment price is not configured for this plan." }
  }

  const price = priceId.startsWith("price_")
    ? await retrieveStripePriceAmount(priceId)
    : null
  if (!price) {
    return { ok: false, status: 500, error: "Could not resolve plan price from Stripe." }
  }

  const customer = await ensureStudentStripeCustomer(studentId)
  if (!customer.ok) return customer

  return {
    ok: true,
    customerId: customer.customerId,
    priceId,
    amountCents: price.amountCents,
    currency: price.currency,
    cadence,
  }
}

export async function resolveInstructorMembershipCheckout(
  instructorId: number,
  tier: string,
  billingCadence: "semester" | "annual",
): Promise<
  | {
      ok: true
      customerId: string
      priceId: string
      amountCents: number
      currency: string
      cadence: "semester" | "annual"
    }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  const paidTier = normalizeInstructorMembershipTier(tier)
  if (paidTier !== "Pro" && paidTier !== "Teams") {
    return { ok: false, status: 400, error: "Invalid tier for payment" }
  }

  const priceId = resolveInstructorStripePriceId(paidTier, billingCadence)
  if (!priceId?.startsWith("price_")) {
    return { ok: false, status: 400, error: "Payment price is not configured for this plan." }
  }

  const price = await retrieveStripePriceAmount(priceId)
  if (!price) {
    return { ok: false, status: 500, error: "Could not resolve plan price from Stripe." }
  }

  const customer = await ensureInstructorStripeCustomer(instructorId)
  if (!customer.ok) return customer

  return {
    ok: true,
    customerId: customer.customerId,
    priceId,
    amountCents: price.amountCents,
    currency: price.currency,
    cadence: billingCadence,
  }
}
