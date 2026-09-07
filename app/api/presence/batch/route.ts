import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { getPresenceBatch } from "@/lib/presence/service"
import { parsePresenceKey, presenceKey } from "@/lib/presence/types"
import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const keysParam = request.nextUrl.searchParams.get("keys")?.trim()
    if (!keysParam) {
      return NextResponse.json({ error: "keys query required" }, { status: 400 })
    }

    const participants = keysParam
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .map(parsePresenceKey)
      .filter((p): p is NonNullable<typeof p> => p != null)

    if (participants.length === 0) {
      return NextResponse.json({ statuses: {} as Record<string, PresenceStatus> })
    }

    const records = await getPresenceBatch(participants.slice(0, 50))
    const statuses: Record<string, PresenceStatus> = {}
    const lastSeenAt: Record<string, string | null> = {}
    const manualStatuses: Record<string, ManualPresenceStatus | null> = {}
    for (const record of records) {
      const key = presenceKey(record.kind, record.id)
      statuses[key] = record.status
      lastSeenAt[key] = record.lastSeenAt
      manualStatuses[key] = record.manualStatus
    }

    return NextResponse.json({ statuses, lastSeenAt, manualStatuses })
  } catch (error) {
    console.error("[presence/batch GET]", error)
    return NextResponse.json({ error: "Failed to load presence" }, { status: 500 })
  }
}
