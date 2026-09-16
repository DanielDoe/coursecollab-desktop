import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { searchMessageRecipients } from "@/lib/direct-messages/service"
import { readInstructorOfferingFromRequest } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
    if (q.length < 2) {
      return NextResponse.json({ recipients: [] })
    }

    const recipients = await searchMessageRecipients(
      actor,
      q,
      20,
      actor.kind === "instructor" ? readInstructorOfferingFromRequest(request) : null,
    )
    return NextResponse.json({ recipients })
  } catch (error) {
    console.error("[messages/recipients GET]", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
