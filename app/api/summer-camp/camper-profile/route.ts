import { type NextRequest, NextResponse } from "next/server"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { getCamperProfile, upsertCamperProfile } from "@/lib/summer-camp/camper-profile"
import { syncCampCamperXp } from "@/lib/summer-camp/camp-xp"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId
    const profile = await getCamperProfile(studentDbId)
    return NextResponse.json({ profile })
  } catch (error) {
    console.error("[summer-camp/camper-profile GET]", error)
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId
    const patch = body.profile
    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ error: "profile object required" }, { status: 400 })
    }
    const profile = await upsertCamperProfile(studentDbId, patch as Record<string, unknown>)
    const xpState = await syncCampCamperXp(studentDbId)
    return NextResponse.json({ profile, totalXp: xpState.total_xp })
  } catch (error) {
    console.error("[summer-camp/camper-profile POST]", error)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}
