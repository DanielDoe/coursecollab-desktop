import { type NextRequest, NextResponse } from "next/server"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"

export async function withCamperAuth(
  request: NextRequest,
  handler: (studentDbId: number) => Promise<Record<string, unknown>>,
  label: string,
) {
  try {
    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    return NextResponse.json(await handler(camper.studentDbId))
  } catch (error) {
    console.error(`[summer-camp/${label}]`, error)
    return NextResponse.json({ error: "Failed to load camp data" }, { status: 500 })
  }
}
