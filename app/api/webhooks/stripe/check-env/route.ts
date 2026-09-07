import { type NextRequest, NextResponse } from "next/server"
import { isProductionRuntime } from "@/lib/compliance/environment"

/**
 * Diagnostic only. Production always 404s — this must never reveal Stripe key
 * prefixes, lengths, or live/test status.
 */
export async function GET(request: NextRequest) {
  if (isProductionRuntime()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const expected = String(process.env.DIAGNOSTIC_TOKEN ?? "").trim()
  const provided = request.headers.get("authorization") ?? ""
  if (!expected || expected === "diagnostic-check" || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  return NextResponse.json({
    environment: process.env.NODE_ENV || "unknown",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    stripeSecretConfigured: Boolean(stripeSecretKey),
    stripeWebhookConfigured: Boolean(stripeWebhookSecret),
  })
}
