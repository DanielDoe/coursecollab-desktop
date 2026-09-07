import { type NextRequest, NextResponse } from "next/server"
import { listUniversityPickerOptions } from "@/lib/universities"

export const dynamic = "force-dynamic"

/** Public list of featured universities + Other — no roster or course data. */
export async function GET() {
  try {
    const universities = await listUniversityPickerOptions()
    return NextResponse.json({ universities })
  } catch (error) {
    console.error("[auth/universities]", error)
    return NextResponse.json({ error: "Failed to load universities", universities: [] }, { status: 500 })
  }
}
