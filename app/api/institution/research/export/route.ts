import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin, canExportResearch } from "@/lib/institutions/auth"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"
import { resolveInstitutionScope } from "@/lib/institutions/metrics/scope"
import { buildMixedEffectsExport } from "@/lib/institutions/metrics/phase5"
import { buildResearchExport } from "@/lib/institutions/research/studies"
import { csvStringToXlsxBuffer } from "@/lib/institutions/research/xlsx-export"

export const dynamic = "force-dynamic"

function xlsxFilename(csvName: string): string {
  return csvName.replace(/\.csv$/i, ".xlsx")
}

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canExportResearch(auth.session.role)) {
    return NextResponse.json({ error: "Research export requires research_admin or academic_admin access" }, { status: 403 })
  }
  const sp = request.nextUrl.searchParams
  const datasetRaw = sp.get("dataset") ?? "summary"
  const format = sp.get("format") ?? "csv"
  const studyId = Number(sp.get("studyId"))

  try {
    if (datasetRaw === "mixed_effects") {
      const scope = await resolveInstitutionScope(auth.session.institutionId, {
        institutionId: auth.session.institutionId,
        from: sp.get("from") ?? "",
        to: sp.get("to") ?? "",
        preset: (sp.get("preset") ?? "last_30_days") as InstitutionDatePreset,
      })
      if (!scope) return NextResponse.json({ error: "Institution not found" }, { status: 404 })
      const file = await buildMixedEffectsExport(auth.session.institutionId, auth.session.userId, scope)
      if (format === "xlsx") {
        const buffer = csvStringToXlsxBuffer(file.csv, "mixed_effects")
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${xlsxFilename(file.filename)}"`,
            "Cache-Control": "no-store",
          },
        })
      }
      return new NextResponse(file.csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const dataset = datasetRaw === "outcomes" ? "outcomes" : "summary"
    if (!Number.isFinite(studyId) || studyId <= 0) {
      return NextResponse.json({ error: "studyId is required" }, { status: 400 })
    }
    const file = await buildResearchExport(auth.session.institutionId, auth.session.userId, studyId, dataset)
    if (format === "json") {
      const comparison = await import("@/lib/institutions/research/studies").then((m) =>
        m.compareResearchStudy(auth.session.institutionId, studyId),
      )
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        studyId,
        dataset,
        rowCount: file.rowCount,
        comparison,
      })
    }
    if (format === "xlsx") {
      const buffer = csvStringToXlsxBuffer(file.csv, dataset)
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${xlsxFilename(file.filename)}"`,
          "Cache-Control": "no-store",
        },
      })
    }
    return new NextResponse(file.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
