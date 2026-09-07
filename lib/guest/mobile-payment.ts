import {
  createMembershipCustomerSession,
  ensureStudentStripeCustomer,
  getStripePublishableKey,
} from "@/lib/membership-mobile-payment"
import {
  getGuestAccessPlan,
  getGuestCoraCreditPack,
  type GuestCoraCreditPackConfig,
} from "@/lib/guest/membership-config"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"

export type GuestCreditPackMobileCheckout = {
  pack: GuestCoraCreditPackConfig
  customerId: string
  email: string
  amountCents: number
  currency: "usd"
  studentId: number
}

export type GuestCareerMobileCheckout = {
  customerId: string
  email: string
  amountCents: number
  currency: "usd"
  studentId: number
  creditsIncluded: number
  label: string
}

async function ensurePlatformGuestCustomer(guestId: number) {
  const verified = await requirePlatformGuestDatabaseId(String(guestId))
  if (verified == null) {
    return { ok: false as const, status: 404, error: "Guest not found" }
  }
  return ensureStudentStripeCustomer(guestId)
}

export async function resolveGuestCreditPackCheckout(
  guestId: number,
  packId: string,
): Promise<
  | { ok: true; checkout: GuestCreditPackMobileCheckout }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  const pack = getGuestCoraCreditPack(packId)
  if (!pack) {
    return { ok: false, status: 400, error: "Invalid credit pack" }
  }

  const customer = await ensurePlatformGuestCustomer(guestId)
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
      amountCents: pack.priceCents,
      currency: "usd",
      studentId: guestId,
    },
  }
}

export async function resolveGuestCareerCheckout(
  guestId: number,
): Promise<
  | { ok: true; checkout: GuestCareerMobileCheckout }
  | { ok: false; status: number; error: string; needsEmail?: boolean }
> {
  const cfg = getGuestAccessPlan("cora_career")
  const customer = await ensurePlatformGuestCustomer(guestId)
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
      customerId: customer.customerId,
      email: customer.email,
      amountCents: cfg.priceCents,
      currency: "usd",
      studentId: guestId,
      creditsIncluded: cfg.coraCreditsIncluded,
      label: cfg.displayName,
    },
  }
}

async function buildPaymentSheetPayload(args: {
  customerId: string
  amountCents: number
  currency: "usd"
  tier: string
  billingCadence: string
  packId?: string
  credits?: number
}) {
  const publishableKey = getStripePublishableKey()
  if (!publishableKey) {
    return { ok: false as const, status: 503, error: "Payment processing is not configured." }
  }
  const customerSessionClientSecret = await createMembershipCustomerSession(args.customerId)
  return {
    ok: true as const,
    payload: {
      publishableKey,
      customerId: args.customerId,
      customerSessionClientSecret,
      amountCents: args.amountCents,
      currency: args.currency,
      tier: args.tier,
      billingCadence: args.billingCadence,
      ...(args.packId ? { packId: args.packId } : {}),
      ...(args.credits != null ? { credits: args.credits } : {}),
      merchantDisplayName: "CourseCollab",
      merchantCountryCode: "US",
    },
  }
}

export async function buildGuestCreditPackPaymentSheetPayload(
  checkout: GuestCreditPackMobileCheckout,
) {
  return buildPaymentSheetPayload({
    customerId: checkout.customerId,
    amountCents: checkout.amountCents,
    currency: checkout.currency,
    tier: checkout.pack.name,
    billingCadence: "one_time",
    packId: checkout.pack.id,
    credits: checkout.pack.credits,
  })
}

export async function buildGuestCareerPaymentSheetPayload(checkout: GuestCareerMobileCheckout) {
  return buildPaymentSheetPayload({
    customerId: checkout.customerId,
    amountCents: checkout.amountCents,
    currency: checkout.currency,
    tier: checkout.label,
    billingCadence: "one_time",
    credits: checkout.creditsIncluded,
  })
}
