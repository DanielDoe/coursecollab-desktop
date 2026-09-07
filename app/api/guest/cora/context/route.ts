import { type NextRequest, NextResponse } from "next/server"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import { getGuestContextForCora } from "@/lib/cora/fetch-guest-context"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGuestCareerGuest(request)
    if (auth instanceof NextResponse) return auth

    const payload = await getGuestContextForCora(auth.guestId)
    return NextResponse.json(payload)
  } catch (e) {
    console.error("[guest/cora/context GET]", e)
    return NextResponse.json({ error: "Failed to load guest context" }, { status: 500 })
  }
}
