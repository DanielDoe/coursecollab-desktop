import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { getPresence, resetManualPresence, setManualPresence, touchPresence } from "@/lib/presence/service"
import type { ManualPresenceStatus } from "@/lib/presence/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_MANUAL: ManualPresenceStatus[] = ["available", "busy", "dnd", "away", "appear_offline"]

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const presence = await getPresence(actor.kind, actor.id)
    return NextResponse.json({ presence })
  } catch (error) {
    console.error("[presence GET]", error)
    return NextResponse.json({ error: "Failed to load presence" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as { status?: ManualPresenceStatus; heartbeat?: boolean; reset?: boolean }
    const presence = body.reset
      ? await resetManualPresence(actor)
      : body.status && VALID_MANUAL.includes(body.status)
        ? await setManualPresence(actor, body.status)
        : await touchPresence(actor)

    return NextResponse.json({ presence })
  } catch (error) {
    console.error("[presence POST]", error)
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
  }
}
