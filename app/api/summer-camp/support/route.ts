import { NextResponse } from "next/server"
import { hubSupport } from "@/lib/summer-camp/camper-hub"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(hubSupport())
}
