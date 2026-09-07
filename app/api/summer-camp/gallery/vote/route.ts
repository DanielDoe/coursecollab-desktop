import { type NextRequest, NextResponse } from "next/server"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { castGalleryVote, syncPeoplesChoiceAward } from "@/lib/summer-camp/showcase"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entryId = Number(body.entryId)

    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId
    if (!Number.isFinite(entryId)) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 })
    }

    const result = await castGalleryVote(entryId, studentDbId)

    const entryRows = await sql`
      SELECT training_id FROM camp_showcase_entries WHERE id = ${entryId} LIMIT 1
    `
    const trainingId = Number(entryRows[0]?.training_id)
    if (trainingId) {
      await syncPeoplesChoiceAward(trainingId).catch(() => {})
    }

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Vote failed"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
