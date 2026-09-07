import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAiNotetakerStudent } from "@/lib/ai-notetaker-request-auth"
import { canAccessAiNotetaker } from "@/lib/ai-notetaker-limits"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { isAiNotetakerClientLogEnabled } from "@/lib/ai-notetaker-client-log-shared"
import type { AiNotetakerClientLogEvent } from "@/lib/ai-notetaker-client-log-shared"

export const dynamic = "force-dynamic"

const PREFIX = "[ai-notetaker:client]"

/** Simple per-student rate limit (burst-friendly for dev). */
const windowMs = 60_000
const maxEventsPerWindow = 400
const rate = new Map<number, { n: number; start: number }>()

function allow(studentId: number): boolean {
  const now = Date.now()
  const w = rate.get(studentId)
  if (!w || now - w.start > windowMs) {
    rate.set(studentId, { n: 1, start: now })
    return true
  }
  if (w.n >= maxEventsPerWindow) return false
  w.n += 1
  return true
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export async function POST(request: NextRequest) {
  if (!isAiNotetakerClientLogEnabled()) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      source?: string
      events?: unknown[]
      studentDatabaseId?: unknown
    } | null
    const auth = await requireAiNotetakerStudent(request, body?.studentDatabaseId)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    if (!allow(studentId)) {
      console.warn(`${PREFIX} rate_limited student=${studentId}`)
      return new NextResponse(null, { status: 429 })
    }

    const tier = await getEffectiveMembershipTier(studentId)
    if (!canAccessAiNotetaker(tier)) {
      console.warn(`${PREFIX} reject notetaker_tier student=${studentId} tier=${tier}`)
      return NextResponse.json({ error: "AI Notetaker not available for this account." }, { status: 403 })
    }

    const ok = await sql`SELECT 1 AS ok FROM students WHERE id = ${studentId} LIMIT 1`
    const okRows = Array.isArray(ok) ? ok : []
    if (okRows.length === 0) {
      console.warn(`${PREFIX} reject unknown_student id=${studentId}`)
      return NextResponse.json({ error: "Invalid student" }, { status: 403 })
    }

    const source = String(body?.source || "unknown").slice(0, 80)
    const rawEvents = Array.isArray(body?.events) ? body!.events : []
    const events = rawEvents.slice(0, 40) as AiNotetakerClientLogEvent[]

    for (const ev of events) {
      if (!ev || typeof ev.ts !== "number" || typeof ev.event !== "string") continue
      const line = {
        studentId,
        source,
        ts: ev.ts,
        event: ev.event.slice(0, 120),
        detail: isPlainObject(ev.detail) ? ev.detail : undefined,
      }
      console.log(`${PREFIX} ${JSON.stringify(line)}`)
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error(`${PREFIX} handler_error`, e)
    return NextResponse.json({ error: "Log failed" }, { status: 500 })
  }
}
