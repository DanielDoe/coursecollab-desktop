import { type NextRequest, NextResponse } from "next/server"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import { listGuestCareerHistory } from "@/lib/guest/career/store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGuestCareerGuest(request)
    if (auth instanceof NextResponse) return auth
    const history = await listGuestCareerHistory(auth.guestId)
    return NextResponse.json(history)
  } catch (e) {
    console.error("[guest/career/history GET]", e)
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 })
  }
}
