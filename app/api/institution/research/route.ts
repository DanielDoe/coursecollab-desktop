import { type NextRequest, NextResponse } from "next/server"
import { canExportResearch, canManageResearchStudies, requireInstitutionAdmin } from "@/lib/institutions/auth"
import {
  addResearchCohort,
  createResearchStudy,
  deleteResearchStudy,
  getResearchWorkspace,
  removeResearchCohort,
  updateResearchStudy,
} from "@/lib/institutions/research/studies"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const studyIdRaw = request.nextUrl.searchParams.get("studyId")
  const studyId = studyIdRaw ? Number(studyIdRaw) : null
  const workspace = await getResearchWorkspace(auth.session.institutionId, Number.isFinite(studyId) ? studyId : null)
  return NextResponse.json(workspace)
}

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canManageResearchStudies(auth.session.role)) {
    return NextResponse.json({ error: "Research study management requires research_admin or academic_admin access" }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action ?? "")
  const institutionId = auth.session.institutionId

  try {
    if (action === "create_study") {
      const study = await createResearchStudy(institutionId, auth.session.userId, {
        name: String(body.name ?? ""),
        description: body.description != null ? String(body.description) : undefined,
        design: body.design != null ? String(body.design) : undefined,
        outcomeMetric: body.outcomeMetric != null ? String(body.outcomeMetric) : undefined,
        fromDate: body.fromDate != null ? String(body.fromDate) : null,
        toDate: body.toDate != null ? String(body.toDate) : null,
        authorizationNote: body.authorizationNote != null ? String(body.authorizationNote) : null,
      })
      return NextResponse.json(await getResearchWorkspace(institutionId, study.id))
    }
    if (action === "update_study") {
      const studyId = Number(body.studyId)
      const study = await updateResearchStudy(institutionId, studyId, {
        name: body.name != null ? String(body.name) : undefined,
        description: body.description != null ? String(body.description) : undefined,
        design: body.design != null ? String(body.design) : undefined,
        outcomeMetric: body.outcomeMetric != null ? String(body.outcomeMetric) : undefined,
        fromDate: body.fromDate != null ? String(body.fromDate) : undefined,
        toDate: body.toDate != null ? String(body.toDate) : undefined,
        authorizationNote: body.authorizationNote != null ? String(body.authorizationNote) : undefined,
      })
      if (!study) return NextResponse.json({ error: "Study not found" }, { status: 404 })
      return NextResponse.json(await getResearchWorkspace(institutionId, study.id))
    }
    if (action === "delete_study") {
      const ok = await deleteResearchStudy(institutionId, Number(body.studyId))
      if (!ok) return NextResponse.json({ error: "Study not found" }, { status: 404 })
      return NextResponse.json(await getResearchWorkspace(institutionId, null))
    }
    if (action === "add_cohort") {
      const studyId = Number(body.studyId)
      await addResearchCohort(institutionId, studyId, {
        name: String(body.name ?? ""),
        roleInStudy: body.roleInStudy != null ? String(body.roleInStudy) : undefined,
        definitionType: body.definitionType != null ? String(body.definitionType) : undefined,
        notes: body.notes != null ? String(body.notes) : undefined,
      })
      return NextResponse.json(await getResearchWorkspace(institutionId, studyId))
    }
    if (action === "remove_cohort") {
      const studyId = Number(body.studyId)
      const ok = await removeResearchCohort(institutionId, Number(body.cohortId))
      if (!ok) return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
      return NextResponse.json(await getResearchWorkspace(institutionId, studyId || null))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
