import { NextResponse } from "next/server"
import { buildActiveTermRolloverPolicy } from "@/lib/active-academic-term"

export const dynamic = "force-dynamic"

/** GET /api/student/rollover/policy — semester-wide Extend self-service status. */
export async function GET() {
  try {
    const policy = await buildActiveTermRolloverPolicy()
    return NextResponse.json({ policy })
  } catch (error) {
    console.error("[rollover/policy]", error)
    return NextResponse.json({ error: "Failed to load rollover policy" }, { status: 500 })
  }
}
