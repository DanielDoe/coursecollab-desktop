import { type NextRequest, NextResponse } from "next/server"
import { withCamperAuth } from "@/lib/summer-camp/camper-api-handler"
import { hubGallery } from "@/lib/summer-camp/graduation"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const trainingId = request.nextUrl.searchParams.get("trainingId")
  return withCamperAuth(request, async (studentDbId) => {
    const tid = trainingId ? Number(trainingId) : undefined
    return hubGallery(studentDbId, Number.isFinite(tid!) ? tid : undefined)
  }, "gallery")
}
