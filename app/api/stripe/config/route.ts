import { NextResponse } from "next/server"
import { getStripePublishableKey } from "@/lib/membership-mobile-payment"

export const runtime = "nodejs"

/** Public Stripe client config for mobile Payment Element. */
export async function GET() {
  const publishableKey = getStripePublishableKey()
  if (!publishableKey) {
    return NextResponse.json(
      { error: "Stripe publishable key is not configured." },
      { status: 503 },
    )
  }
  return NextResponse.json({
    publishableKey,
    merchantDisplayName: "CourseCollab",
    merchantCountryCode: "US",
  })
}
