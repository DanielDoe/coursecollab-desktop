import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { loadInstitutionCoraInsights } from "@/lib/cora/insights/institution"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  try {
    const data = await loadInstitutionCoraInsights(auth.session.institutionId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[institution/cora-insights]", error)
    return NextResponse.json({ error: "Failed to load institution Cora Insights" }, { status: 500 })
  }
}
