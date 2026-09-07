import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getInstitutionOverview } from "@/lib/institutions/overview"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const sp = request.nextUrl.searchParams
  const overview = await getInstitutionOverview(auth.session.institutionId, {
    role: auth.session.role,
    preset: (sp.get("preset") as import("@/lib/institutions/metrics/constants").InstitutionDatePreset) ?? "last_30_days",
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  })
  if (!overview) return NextResponse.json({ error: "Institution not found" }, { status: 404 })
  return NextResponse.json({ ...overview, role: auth.session.role })
}
