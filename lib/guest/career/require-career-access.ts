import { type NextRequest, NextResponse } from "next/server"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { guestHasCapability } from "@/lib/guest/capabilities"
import type { CareerAccessTier } from "@/lib/guest/career/preview-gate"

export type GuestCareerAuth = {
  guestId: number
  accessTier: CareerAccessTier
  hasFullAccess: boolean
}

async function resolveGuestId(
  request: NextRequest,
  body?: Record<string, unknown>,
): Promise<number | NextResponse> {
  const url = new URL(request.url)
  const raw =
    String(body?.studentDatabaseId ?? "").trim() ||
    url.searchParams.get("studentDatabaseId")?.trim() ||
    ""

  if (!raw) {
    return NextResponse.json({ error: "studentDatabaseId required" }, { status: 400 })
  }

  const guestId = await requirePlatformGuestDatabaseId(raw)
  if (guestId == null) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 })
  }

  return guestId
}

/** Any platform guest — free users can scan; full detail requires Cora Career. */
export async function requireGuestCareerGuest(
  request: NextRequest,
  body?: Record<string, unknown>,
): Promise<GuestCareerAuth | NextResponse> {
  const guestId = await resolveGuestId(request, body)
  if (guestId instanceof NextResponse) return guestId

  const resolved = await resolveGuestCapabilities(guestId)
  const hasFullAccess = guestHasCapability(resolved.capabilities, "career.cora")

  return {
    guestId,
    hasFullAccess,
    accessTier: hasFullAccess ? "full" : "preview",
  }
}

/** Hard gate — only for endpoints that must never run without unlock (e.g. AI optimize). */
export async function requireGuestCareerAccess(
  request: NextRequest,
  body?: Record<string, unknown>,
): Promise<{ guestId: number } | NextResponse> {
  const auth = await requireGuestCareerGuest(request, body)
  if (auth instanceof NextResponse) return auth

  if (!auth.hasFullAccess) {
    return NextResponse.json(
      { error: "Cora Career unlock required", upgradeUrl: "/guest/cora-career/access" },
      { status: 403 },
    )
  }

  return { guestId: auth.guestId }
}
