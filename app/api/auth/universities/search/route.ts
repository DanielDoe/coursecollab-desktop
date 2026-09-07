import { type NextRequest, NextResponse } from "next/server"
import { searchUniversitiesForPicker } from "@/lib/universities"

export const dynamic = "force-dynamic"

/** Search local universities plus the Hipo open university-domains list. */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? ""
    if (q.trim().length < 2) {
      return NextResponse.json({ universities: [] })
    }
    const universities = await searchUniversitiesForPicker(q)
    return NextResponse.json({ universities })
  } catch (error) {
    console.error("[auth/universities/search]", error)
    return NextResponse.json({ error: "Search failed", universities: [] }, { status: 500 })
  }
}
