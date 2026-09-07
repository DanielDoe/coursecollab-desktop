import { type NextRequest, NextResponse } from "next/server"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import { careerAccessMeta, gateCareerAnalysis, careerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import { getGuestApplication, listGuestApplications } from "@/lib/guest/career/store"
import { rowToAnalysis } from "@/lib/guest/career/row-mappers"
import { sql } from "@/lib/db"
import { ensureGuestCareerIntelligenceSchema } from "@/lib/guest/career/ensure-schema"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGuestCareerGuest(request)
    if (auth instanceof NextResponse) return auth

    const applicationId = Number(new URL(request.url).searchParams.get("applicationId") ?? "")
    if (Number.isFinite(applicationId) && applicationId > 0) {
      const application = await getGuestApplication(auth.guestId, applicationId)
      if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 })

      let analysis = null
      let fullAnalysis = null
      if (application.latestAnalysisId) {
        await ensureGuestCareerIntelligenceSchema()
        const rows = await sql`
          SELECT * FROM guest_career_analyses
          WHERE id = ${application.latestAnalysisId} AND guest_id = ${auth.guestId}
          LIMIT 1
        `
        if (rows[0]) {
          fullAnalysis = rowToAnalysis(rows[0] as Record<string, unknown>)
          analysis = gateCareerAnalysis(fullAnalysis, auth.accessTier)
        }
      }
      return NextResponse.json({
        ...careerAccessMeta(auth.accessTier),
        issueCounts: fullAnalysis ? careerAnalysisIssueCounts(fullAnalysis) : null,
        application,
        analysis,
      })
    }

    const applications = await listGuestApplications(auth.guestId)
    return NextResponse.json({ ...careerAccessMeta(auth.accessTier), applications })
  } catch (e) {
    console.error("[guest/career/applications GET]", e)
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 })
  }
}
