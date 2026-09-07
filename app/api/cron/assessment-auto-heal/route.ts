import { type NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { runAssessmentAutoHeal } from "@/lib/assessment-auto-heal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300
export const revalidate = 0

/**
 * Cron: proactively heal common assessment defects before they become system log issues.
 * Schedule: every 4 hours (see vercel.json).
 */
export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const result = await runAssessmentAutoHeal({ dryRun: false, lookbackDays: 45 })

    console.log(
      `[cron/assessment-auto-heal] healed=${result.healed.length} skipped=${result.skipped.length} errors=${result.errors.length}`,
    )

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    console.error("[cron/assessment-auto-heal] failed", error)
    return NextResponse.json(
      { error: "Assessment auto-heal failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
