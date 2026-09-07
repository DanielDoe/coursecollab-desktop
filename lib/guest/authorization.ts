import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import type { GuestCapability } from "@/lib/guest/types"
import { isGuestFeatureEnabled } from "@/lib/guest/feature-flags"

export type GuestEntitlementsSnapshot = Awaited<ReturnType<typeof getGuestEntitlements>>

export async function getGuestEntitlements(studentId: number) {
  const resolved = await resolveGuestCapabilities(studentId)
  return {
    studentId,
    plan: resolved.plan,
    status: resolved.status,
    capabilities: resolved.capabilities,
    entitlement: resolved.entitlement,
  }
}

export async function hasGuestCapability(
  studentId: number,
  capability: GuestCapability,
): Promise<boolean> {
  const { capabilities } = await getGuestEntitlements(studentId)
  if (capability.startsWith("career.") && !isGuestFeatureEnabled("coraCareerEnabled")) {
    if (capability === "career.cora") return false
  }
  if (capability === "cora.generateRecommendationBrief") {
    if (!isGuestFeatureEnabled("recommendationBriefEnabled")) return false
  }
  return guestHasCapability(capabilities, capability)
}

export class GuestAuthorizationError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.status = status
  }
}

export async function requireGuestCapability(
  studentId: number,
  capability: GuestCapability,
): Promise<GuestEntitlementsSnapshot> {
  const guestId = Number(studentId)
  if (!Number.isFinite(guestId) || guestId <= 0) {
    throw new GuestAuthorizationError("Invalid guest identity", 400)
  }

  const rows = await sql`
    SELECT id FROM students
    WHERE id = ${guestId} AND COALESCE(is_platform_guest, false) = true
    LIMIT 1
  `
  if (rows.length === 0) {
    throw new GuestAuthorizationError("Not a Career Member account", 403)
  }

  const snapshot = await getGuestEntitlements(guestId)
  const allowed = await hasGuestCapability(guestId, capability)
  if (!allowed) {
    throw new GuestAuthorizationError("This feature requires Cora Career.", 403)
  }
  return snapshot
}

export async function requireGuestCapabilityFromRequest(
  rawStudentId: string | null | undefined,
  capability: GuestCapability,
): Promise<{ guestId: number; snapshot: GuestEntitlementsSnapshot }> {
  const guestId = await requirePlatformGuestDatabaseId(String(rawStudentId ?? "").trim())
  if (guestId == null) {
    throw new GuestAuthorizationError("Guest not found", 404)
  }
  const snapshot = await requireGuestCapability(guestId, capability)
  return { guestId, snapshot }
}

export function guestAuthErrorResponse(err: unknown) {
  if (err instanceof GuestAuthorizationError) {
    return NextResponse.json({ error: err.message, code: "GUEST_FORBIDDEN" }, { status: err.status })
  }
  console.error("[guest/authorization]", err)
  return NextResponse.json({ error: "Authorization failed" }, { status: 500 })
}
