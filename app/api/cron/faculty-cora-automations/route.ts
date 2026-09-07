import { type NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { runDueFacultyAutomations } from "@/lib/cora/faculty-automations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const result = await runDueFacultyAutomations(12)

    console.log(
      `[cron/faculty-cora-automations] processed=${result.processed} completed=${result.completed} failed=${result.failed}`,
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[cron/faculty-cora-automations]", error)
    return NextResponse.json(
      { error: "Faculty Cora automations failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
