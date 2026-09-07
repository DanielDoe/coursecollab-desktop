import { type NextRequest, NextResponse } from "next/server"
import {
  buildGuestCreditPackPaymentSheetPayload,
  resolveGuestCreditPackCheckout,
} from "@/lib/guest/mobile-payment"
import { requirePlatformGuestDatabaseId } from "@/lib/require-platform-guest"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const guestId = await requirePlatformGuestDatabaseId(String(body.studentDatabaseId ?? ""))
    const packId = String(body.packId ?? "")
    if (guestId == null || !packId) {
      return NextResponse.json({ error: "studentDatabaseId and packId are required" }, { status: 400 })
    }

    const resolved = await resolveGuestCreditPackCheckout(guestId, packId)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, needsEmail: resolved.needsEmail },
        { status: resolved.status },
      )
    }

    const sheet = await buildGuestCreditPackPaymentSheetPayload(resolved.checkout)
    if (!sheet.ok) {
      return NextResponse.json({ error: sheet.error }, { status: sheet.status })
    }

    return NextResponse.json(sheet.payload)
  } catch (error: unknown) {
    console.error("[guest/cora-credits/mobile-payment-sheet] failed:", error)
    return NextResponse.json(
      {
        error: "Failed to prepare payment session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
