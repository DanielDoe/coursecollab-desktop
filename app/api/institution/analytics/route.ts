import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionAnalyticsMetrics } from "@/lib/institutions/metrics/analytics"
import type { AnalyticsTab } from "@/lib/institutions/metrics/types"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"

export const dynamic = "force-dynamic"

const ANALYTICS_TABS: AnalyticsTab[] = [
  "overview",
  "engagement",
  "retention",
  "learning",
  "assessments",
  "cora",
  "faculty",
  "courses",
  "adoption",
  "license",
  "independent",
  "cognitive",
  "interventions",
  "student_success",
  "equity",
  "research",
  "data_quality",
  "longitudinal",
  "pathways",
  "questions",
  "feedback",
]

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response

  const sp = request.nextUrl.searchParams
  const tabRaw = sp.get("tab") ?? "overview"
  const tab = (ANALYTICS_TABS.includes(tabRaw as AnalyticsTab) ? tabRaw : "overview") as AnalyticsTab
  const preset = (sp.get("preset") ?? "last_30_days") as InstitutionDatePreset

  const metrics = await getInstitutionAnalyticsMetrics(auth.session.institutionId, auth.session.role, tab, {
    institutionId: auth.session.institutionId,
    licenseId: null,
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    preset,
    courseId: sp.get("courseId") ? Number(sp.get("courseId")) : null,
    organizationUnitId: sp.get("organizationUnitId") ? Number(sp.get("organizationUnitId")) : null,
    instructorId: sp.get("instructorId") ? Number(sp.get("instructorId")) : null,
    sectionId: sp.get("sectionId") ? Number(sp.get("sectionId")) : null,
    programId: sp.get("programId") ? Number(sp.get("programId")) : null,
  })

  if (!metrics) return NextResponse.json({ error: "Institution not found" }, { status: 404 })
  return NextResponse.json(metrics)
}
