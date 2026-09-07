import { type NextRequest, NextResponse } from "next/server"
import { withCamperAuth } from "@/lib/summer-camp/camper-api-handler"
import { hubLeaderboard } from "@/lib/summer-camp/camper-hub"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const trainingIdRaw = request.nextUrl.searchParams.get("trainingId")
  const trainingId = trainingIdRaw != null ? Number(trainingIdRaw) : undefined
  return withCamperAuth(
    request,
    (studentDbId) => hubLeaderboard(studentDbId, Number.isFinite(trainingId!) ? trainingId : undefined),
    "leaderboard",
  )
}
