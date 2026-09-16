import { type NextRequest, NextResponse } from "next/server"
import { resolveFacultyInsightsScope } from "@/lib/cora/insights/scope"
import {
  loadAssistance,
  loadInsightsFilters,
  loadInterventions,
  loadLearningGaps,
  loadLive,
  loadOverview,
  loadPredictions,
  loadStudentNeeds,
  loadUsage,
  loadConceptDetail,
} from "@/lib/cora/insights/query"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const resolved = await resolveFacultyInsightsScope(request)
  if (!resolved.ok) return resolved.response
  const tab = request.nextUrl.searchParams.get("tab") || "overview"
  const scope = resolved.scope
  try {
    if (tab === "filters") {
      return NextResponse.json({ ok: true, data: await loadInsightsFilters(scope) })
    }
    if (tab === "overview") {
      return NextResponse.json({ ok: true, data: await loadOverview(scope) })
    }
    if (tab === "needs") {
      return NextResponse.json({ ok: true, data: await loadStudentNeeds(scope) })
    }
    if (tab === "gaps") {
      const concept = request.nextUrl.searchParams.get("concept")
      const data = await loadLearningGaps(scope)
      if (concept) data.conceptDetail = await loadConceptDetail(scope, concept)
      return NextResponse.json({ ok: true, data })
    }
    if (tab === "usage") {
      return NextResponse.json({ ok: true, data: await loadUsage(scope) })
    }
    if (tab === "assistance") {
      return NextResponse.json({ ok: true, data: await loadAssistance(scope) })
    }
    if (tab === "live") {
      const filter = request.nextUrl.searchParams.get("liveFilter") || "all"
      return NextResponse.json({ ok: true, data: await loadLive(scope, filter) })
    }
    if (tab === "predictions") {
      return NextResponse.json({ ok: true, data: await loadPredictions(scope) })
    }
    if (tab === "interventions") {
      return NextResponse.json({ ok: true, data: await loadInterventions(scope) })
    }
    return NextResponse.json({ error: "Unknown tab" }, { status: 400 })
  } catch (error) {
    console.error("[cora-insights]", error)
    return NextResponse.json({ error: "Failed to load Cora Insights" }, { status: 500 })
  }
}
