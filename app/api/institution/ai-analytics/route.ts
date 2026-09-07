import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import {
  buildInstitutionAiAnalyticsReport,
  courseBelongsToInstitution,
} from "@/lib/cora/analytics/institution-ai-report"

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
 * AI usage analytics for institution portal accounts (grant/proposal reporting).
 * Institution scope comes from the authenticated session — never from the client.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireInstitutionAdmin(request)
    if (!auth.ok) return auth.response

    const sp = request.nextUrl.searchParams
    const courseId = parseIdParam(sp.get("courseId"))
    if (courseId != null) {
      const owned = await courseBelongsToInstitution(courseId, auth.session.institutionId)
      if (!owned) {
        return NextResponse.json(
          { error: "Course not found in your institution" },
          { status: 403 },
        )
      }
    }

    const report = await buildInstitutionAiAnalyticsReport({
      institutionId: auth.session.institutionId,
      courseId,
      from: parseDateParam(sp.get("from")),
      to: parseDateParam(sp.get("to")),
    })

    return NextResponse.json({
      ...report,
      scope: {
        ...report.scope,
        institutionName: auth.session.institutionName,
      },
    })
  } catch (error) {
    console.error("[institution/ai-analytics]", error)
    return NextResponse.json({ error: "Failed to load AI analytics" }, { status: 500 })
  }
}
