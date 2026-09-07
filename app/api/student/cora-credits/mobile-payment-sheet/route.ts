import { type NextRequest, NextResponse } from "next/server"
import {
  buildCoraPackPaymentSheetPayload,
  resolveStudentCoraPackCheckout,
} from "@/lib/cora/credits/mobile-payment"

export const runtime = "nodejs"

/** Prepare native PaymentSheet for a student Cora Credit Pack. */
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const studentId = parseInt(String(body.studentId ?? ""), 10)
    const packId = String(body.packId ?? "")
    if (!Number.isFinite(studentId) || !packId) {
      return NextResponse.json({ error: "studentId and packId are required" }, { status: 400 })
    }

    const resolved = await resolveStudentCoraPackCheckout(studentId, packId)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, needsEmail: resolved.needsEmail },
        { status: resolved.status },
      )
    }

    const sheet = await buildCoraPackPaymentSheetPayload(resolved.checkout)
    if (!sheet.ok) {
      return NextResponse.json({ error: sheet.error }, { status: sheet.status })
    }

    return NextResponse.json(sheet.payload)
  } catch (error: unknown) {
    console.error("[cora-credits/mobile-payment-sheet] student failed:", error)
    return NextResponse.json(
      {
        error: "Failed to prepare payment session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
