import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { getAnalyticsFilterOptions } from "@/lib/institutions/metrics/phase4"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  const options = await getAnalyticsFilterOptions(auth.session.institutionId)
  return NextResponse.json(options)
}
