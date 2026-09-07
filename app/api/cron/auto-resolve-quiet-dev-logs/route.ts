import { type NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { sweepQuietDevOpenGroups } from "@/lib/system-log-dev-resolve"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/** Auto-resolve open dev issues that have had no new events for DEV_QUIET_RESOLVE_MINUTES. */
export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const result = await sweepQuietDevOpenGroups({
      resolvedBy: "cron:dev-quiet-sweep",
    })

    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[cron/auto-resolve-quiet-dev-logs] failed", error)
    return NextResponse.json({ error: "Quiet dev sweep failed" }, { status: 500 })
  }
}
