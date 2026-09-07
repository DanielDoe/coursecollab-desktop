import { NextResponse, type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { collectProductionConfigIssues, isProductionRuntime } from "@/lib/compliance/environment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const cron = requireCronAuth(request)
  if (!cron.ok) return cron.response

  let database = "unknown"
  try {
    await sql`SELECT 1`
    database = "connected"
  } catch {
    database = "disconnected"
  }

  const issues = isProductionRuntime()
    ? collectProductionConfigIssues(process.env, { requirePayments: false, requireAi: false })
        .filter((issue) => issue.severity === "blocker")
        .map((issue) => issue.code)
    : []

  const ready = database === "connected" && issues.length === 0
  return NextResponse.json(
    {
      ready,
      database,
      blockers: issues,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}
