import { type NextRequest } from "next/server"
import { withCamperAuth } from "@/lib/summer-camp/camper-api-handler"
import { listFeedbackCards } from "@/lib/summer-camp/showcase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const trainingId = request.nextUrl.searchParams.get("trainingId")
  return withCamperAuth(request, async (studentDbId) => {
    const tid = trainingId ? Number(trainingId) : undefined
    const cards = await listFeedbackCards(studentDbId, Number.isFinite(tid!) ? tid : undefined)
    return { cards }
  }, "feedback-cards")
}
