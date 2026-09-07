import { type NextRequest, NextResponse } from "next/server"
import { canManageResearchStudies, requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getEquitySubgroupAnalytics, importEquityAttributes } from "@/lib/institutions/research/equity-subgroups"
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
  return NextResponse.json(await getEquitySubgroupAnalytics(scope, auth.session.institutionId))
}

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canManageResearchStudies(auth.session.role)) {
    return NextResponse.json({ error: "Research configuration access denied" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    rows?: Array<{ studentId: number; attributeKey: string; attributeValue: string }>
  }

  const imported = await importEquityAttributes({
    institutionId: auth.session.institutionId,
    authorizedByUserId: auth.session.userId,
    rows: body.rows ?? [],
  })
  return NextResponse.json({ success: true, imported })
}
