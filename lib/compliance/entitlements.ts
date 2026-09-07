/**
 * Provider-independent entitlement reads.
 * Clients must never grant access by sending subscriptionActive: true.
 */

import { getEffectiveMembershipTier, getStudentMembership } from "@/lib/membership"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { getInstructorMembership } from "@/lib/instructor-membership"

export type EntitlementActor = {
  role: "student" | "guest" | "instructor"
  accountId: number
}

export type EntitlementSnapshot = {
  role: EntitlementActor["role"]
  accountId: number
  plan: string
  status: string
  source: "server"
  provider: "stripe" | "institutional" | "none"
  features: Record<string, unknown>
}

export function rejectClientEntitlementClaims(body: unknown): boolean {
  if (!body || typeof body !== "object") return false
  const record = body as Record<string, unknown>
  return (
    record.subscriptionActive === true ||
    record.isPremium === true ||
    record.entitled === true ||
    record.restorePurchases === true
  )
}

export async function getServerEntitlements(
  actor: EntitlementActor,
): Promise<EntitlementSnapshot> {
  if (actor.role === "instructor") {
    const membership = await getInstructorMembership(actor.accountId)
    const plan = String(membership?.tier ?? "Free")
    return {
      role: "instructor",
      accountId: actor.accountId,
      plan,
      status: String(membership?.membership?.status ?? (plan === "Free" ? "none" : "active")),
      source: "server",
      provider: plan !== "Free" ? "stripe" : "none",
      features: { tier: plan },
    }
  }

  if (actor.role === "guest") {
    const resolved = await resolveGuestCapabilities(actor.accountId)
    return {
      role: "guest",
      accountId: actor.accountId,
      plan: String(resolved.plan),
      status: String(resolved.status),
      source: "server",
      provider: resolved.plan === "guest_free" ? "none" : "stripe",
      features: { capabilities: resolved.capabilities },
    }
  }

  const [tier, membership] = await Promise.all([
    getEffectiveMembershipTier(actor.accountId),
    getStudentMembership(actor.accountId),
  ])
  return {
    role: "student",
    accountId: actor.accountId,
    plan: String(tier ?? "Scholar"),
    status: String(membership?.status ?? (tier && tier !== "Scholar" ? "active" : "none")),
    source: "server",
    provider: tier && tier !== "Scholar" ? "stripe" : "none",
    features: { tier: tier ?? "Scholar" },
  }
}
