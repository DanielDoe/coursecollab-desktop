import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { buildInstitutionAiAnalyticsReport } from "@/lib/cora/analytics/institution-ai-report"

export const dynamic = "force-dynamic"

function parseDateParam(value: string | null): string | undefined {
  if (!value?.trim()) return undefined
  return value.trim().slice(0, 10)
}

function parseIdParam(value: string | null): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
}

/**
 * Platform-admin view of any institution's AI analytics (support/ops).
 * Institution accounts should use /api/institution/ai-analytics instead,
 * which scopes to their own session-bound institution.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const institutionId = parseIdParam(url.searchParams.get("institutionId"))
    if (!institutionId) {
      return NextResponse.json({ error: "institutionId is required" }, { status: 400 })
    }

    const report = await buildInstitutionAiAnalyticsReport({
      institutionId,
      courseId: parseIdParam(url.searchParams.get("courseId")),
      from: parseDateParam(url.searchParams.get("from")),
      to: parseDateParam(url.searchParams.get("to")),
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error("[admin/ai-analytics]", error)
    return NextResponse.json({ error: "Failed to load AI analytics" }, { status: 500 })
  }
}
