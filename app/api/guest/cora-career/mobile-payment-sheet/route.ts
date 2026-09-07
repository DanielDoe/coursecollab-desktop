import { type NextRequest, NextResponse } from "next/server"
import {
  buildGuestCareerPaymentSheetPayload,
  resolveGuestCareerCheckout,
} from "@/lib/guest/mobile-payment"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"
import { getGuestFeatureFlags } from "@/lib/guest/feature-flags"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const flags = getGuestFeatureFlags()
    if (!flags.guestMembershipEnabled || !flags.coraCareerEnabled) {
      return NextResponse.json({ error: "Cora Career checkout is not available yet." }, { status: 503 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const guestId = await requirePlatformGuestDatabaseId(String(body.studentDatabaseId ?? ""))
    if (guestId == null) {
      return NextResponse.json({ error: "studentDatabaseId is required" }, { status: 400 })
    }

    const resolved = await resolveGuestCareerCheckout(guestId)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, needsEmail: resolved.needsEmail },
        { status: resolved.status },
      )
    }

    const sheet = await buildGuestCareerPaymentSheetPayload(resolved.checkout)
    if (!sheet.ok) {
      return NextResponse.json({ error: sheet.error }, { status: sheet.status })
    }

    return NextResponse.json(sheet.payload)
  } catch (error: unknown) {
    console.error("[guest/cora-career/mobile-payment-sheet] failed:", error)
    return NextResponse.json(
      {
        error: "Failed to prepare payment session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
