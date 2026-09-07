import { type NextRequest } from "next/server"
import { withCamperAuth } from "@/lib/summer-camp/camper-api-handler"
import { hubRoadmap } from "@/lib/summer-camp/camper-hub"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCamperAuth(request, hubRoadmap, "roadmap")
}
