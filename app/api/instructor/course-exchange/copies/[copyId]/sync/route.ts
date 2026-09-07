import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  applyExchangeSyncUpdates,
  computeExchangeSyncDiff,
} from "@/lib/course-exchange/sync-service"

export const dynamic = "force-dynamic"

type RouteParams = { params: Promise<{ copyId: string }> }

/** Check for creator updates or fetch diff / apply selected changes. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const copyId = Number((await params).copyId)
    if (!Number.isFinite(copyId)) {
      return NextResponse.json({ error: "Invalid copy id" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const force = searchParams.get("force") === "1"

    const diff = await computeExchangeSyncDiff(copyId, session.instructorId, { force })

    if (!diff) return NextResponse.json({ error: "Copy not found" }, { status: 404 })

    return NextResponse.json({ diff, cached: !force })
  } catch (error) {
    console.error("[course-exchange/copies/sync GET]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check updates" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const copyId = Number((await params).copyId)
    if (!Number.isFinite(copyId)) {
      return NextResponse.json({ error: "Invalid copy id" }, { status: 400 })
    }

    const body = await request.json()
    const changeIds = Array.isArray(body.changeIds) ? body.changeIds.map(String) : []
    if (changeIds.length === 0) {
      return NextResponse.json({ error: "changeIds is required" }, { status: 400 })
    }

    const result = await applyExchangeSyncUpdates(copyId, session.instructorId, changeIds)
    return NextResponse.json({ result })
  } catch (error) {
    console.error("[course-exchange/copies/sync POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply updates" },
      { status: 400 },
    )
  }
}
