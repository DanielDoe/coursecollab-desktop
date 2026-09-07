import { type NextRequest, NextResponse } from "next/server"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import { careerAccessMeta } from "@/lib/guest/career/preview-gate"
import {
  getComplimentaryResumeMatchStatus,
  complimentaryMatchMeta,
} from "@/lib/guest/career/complimentary-matches"
import {
  getGuestMasterResume,
  listGuestApplications,
} from "@/lib/guest/career/store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGuestCareerGuest(request)
    if (auth instanceof NextResponse) return auth

    const [masterResume, applications, complimentary] = await Promise.all([
      getGuestMasterResume(auth.guestId),
      listGuestApplications(auth.guestId),
      getComplimentaryResumeMatchStatus(auth.guestId),
    ])

    return NextResponse.json({
      ...careerAccessMeta(auth.accessTier),
      ...complimentaryMatchMeta(complimentary),
      masterResume,
      applications,
    })
  } catch (e) {
    console.error("[guest/career/home GET]", e)
    return NextResponse.json({ error: "Failed to load career home" }, { status: 500 })
  }
}
