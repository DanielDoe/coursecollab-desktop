import { type NextRequest } from "next/server"
import { withCamperAuth } from "@/lib/summer-camp/camper-api-handler"
import { hubGraduation } from "@/lib/summer-camp/graduation"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCamperAuth(request, (studentDbId) => hubGraduation(studentDbId), "graduation")
}
