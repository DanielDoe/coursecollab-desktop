import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import {
  assertActorCanViewParticipantProfile,
  loadParticipantProfile,
} from "@/lib/direct-messages/participant-profile"
import type { ParticipantKind } from "@/lib/direct-messages/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ kind: string; id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { kind: kindRaw, id: idRaw } = await context.params
    if (kindRaw !== "student" && kindRaw !== "instructor") {
      return NextResponse.json({ error: "Invalid participant type" }, { status: 400 })
    }
    const targetKind = kindRaw as ParticipantKind
    const targetId = Number(idRaw)
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid participant" }, { status: 400 })
    }

    await assertActorCanViewParticipantProfile(actor, targetKind, targetId)
    const profile = await loadParticipantProfile(targetKind, targetId)
    if (!profile) return NextResponse.json({ error: "Participant not found" }, { status: 404 })

    return NextResponse.json({ profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile"
    console.error("[messages/participant profile GET]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
