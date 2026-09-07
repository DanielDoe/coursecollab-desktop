import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionDashboardMetrics } from "@/lib/institutions/metrics/dashboard"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response

  const sp = request.nextUrl.searchParams
  const preset = (sp.get("preset") ?? "last_30_days") as InstitutionDatePreset
  const from = sp.get("from")
  const to = sp.get("to")
  const courseId = sp.get("courseId")

  const metrics = await getInstitutionDashboardMetrics(auth.session.institutionId, auth.session.role, {
    institutionId: auth.session.institutionId,
    licenseId: null,
    from: from ?? "",
    to: to ?? "",
    preset,
    courseId: courseId ? Number(courseId) : null,
    organizationUnitId: sp.get("organizationUnitId") ? Number(sp.get("organizationUnitId")) : null,
  })

  if (!metrics) return NextResponse.json({ error: "Institution not found" }, { status: 404 })
  return NextResponse.json(metrics)
}
