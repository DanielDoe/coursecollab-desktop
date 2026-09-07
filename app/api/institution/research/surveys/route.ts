import { type NextRequest, NextResponse } from "next/server"
import { canManageResearchStudies, requireInstitutionAdmin } from "@/lib/institutions/auth"
import {
  SURVEY_CONSTRUCTS,
  getSurveyConstructAnalytics,
  importSurveyResponses,
  upsertSurveyInstrument,
  type SurveyConstruct,
} from "@/lib/institutions/research/survey-constructs"
import { resolveInstitutionScope } from "@/lib/institutions/metrics/scope"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const scope = await resolveInstitutionScope(auth.session.institutionId, {
    institutionId: auth.session.institutionId,
    preset: (request.nextUrl.searchParams.get("preset") ?? "last_30_days") as InstitutionDatePreset,
    from: request.nextUrl.searchParams.get("from") ?? "",
    to: request.nextUrl.searchParams.get("to") ?? "",
  })
  if (!scope) return NextResponse.json({ error: "Institution not found" }, { status: 404 })
  const analytics = await getSurveyConstructAnalytics(scope, auth.session.institutionId)
  return NextResponse.json(analytics)
}

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canManageResearchStudies(auth.session.role)) {
    return NextResponse.json({ error: "Research configuration access denied" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    name?: string
    construct?: string
    scaleMin?: number
    scaleMax?: number
    itemCount?: number
    sourceCitation?: string
    instrumentId?: number
    responses?: Array<{ studentId: number; courseId?: number; totalScore: number }>
  }

  if (body.action === "import_responses") {
    const instrumentId = Number(body.instrumentId)
    if (!Number.isFinite(instrumentId) || instrumentId <= 0) {
      return NextResponse.json({ error: "instrumentId is required" }, { status: 400 })
    }
    const count = await importSurveyResponses({
      institutionId: auth.session.institutionId,
      instrumentId,
      responses: body.responses ?? [],
    })
    return NextResponse.json({ success: true, imported: count })
  }

  const construct = String(body.construct ?? "") as SurveyConstruct
  if (!SURVEY_CONSTRUCTS.includes(construct)) {
    return NextResponse.json({ error: "Valid construct is required" }, { status: 400 })
  }
  const id = await upsertSurveyInstrument({
    institutionId: auth.session.institutionId,
    name: String(body.name ?? "Imported instrument"),
    construct,
    scaleMin: body.scaleMin,
    scaleMax: body.scaleMax,
    itemCount: body.itemCount,
    sourceCitation: body.sourceCitation,
  })
  return NextResponse.json({ success: true, instrumentId: id })
}
