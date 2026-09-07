import { NextResponse } from "next/server"

/**
 * Many Stripe Dashboard configs use this URL. The full handler lives at
 * `/api/membership/webhook` (checkout → DB upgrade → grantMembershipPerks).
 * Re-exporting POST ensures purchases always sync even if only this endpoint is registered.
 */
export { POST } from "../../membership/webhook/route"

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } })
}
