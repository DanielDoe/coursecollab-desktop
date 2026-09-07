import { NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { fetchTradeCenterAnalytics } from "@/lib/trade-center-analytics-query"
import { loadInstructorTradeLogPayload, loadInstructorDonationsHubPendingPayload } from "@/lib/trade-center-instructor-trade-log-data"
import {
  fetchMergedRolloverRows,
  filterRolloverRows,
  mapRolloverRowToTrade,
} from "@/lib/trade-center-rollover-trades-query"
import {
  exportTradeCenterAnalyticsToPDF,
  exportTradeCenterDonationsHubToPDF,
  exportTradeCenterRolloversToPDF,
  exportTradeCenterTradeLogToPDF,
} from "@/lib/pdf-export"
import { resolvePdfArchiveMeta, type PdfArchiveReportKind } from "@/lib/pdf-export-archive-meta"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const REPORT_ARCHIVE_KIND: Record<string, PdfArchiveReportKind> = {
  analytics: "trade-center-analytics",
  "trade-log": "trade-center-trade-log",
  rollovers: "trade-center-rollovers",
  donations: "trade-center-donations",
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const reportKey = (searchParams.get("report") || "analytics").toLowerCase()
    const archiveKind = REPORT_ARCHIVE_KIND[reportKey]
    if (!archiveKind) {
      return NextResponse.json(
        { error: "Invalid report", allowed: Object.keys(REPORT_ARCHIVE_KIND) },
        { status: 400 },
      )
    }

    const rawSession = searchParams.get("session")?.trim() || "ALL"
    const sessionForMeta = rawSession.toUpperCase() === "ALL" ? "all" : rawSession
    const scopeLabel = rawSession.toUpperCase() === "ALL" ? "All sections" : `Section ${rawSession}`
    const sessionForScopedQueries = rawSession.toUpperCase() === "ALL" ? "" : rawSession
    const search = (searchParams.get("search") || "").trim()

    const archiveMeta = await resolvePdfArchiveMeta(request, sessionForMeta, archiveKind)

    let pdf: ReturnType<typeof exportTradeCenterAnalyticsToPDF>

    if (reportKey === "analytics") {
      const payload = await fetchTradeCenterAnalytics(scope.course.id, rawSession)
      const weekLabel = (iso: string) =>
        iso
          ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "America/Chicago",
            })
          : ""

      const reportingWeekLabel = weekLabel(payload.weekStartDate)
      const calendarWeekLabel = weekLabel(payload.calendarWeekStart)
      const subtitle = payload.usedFallbackWeek
        ? `${scopeLabel} · Showing week of ${reportingWeekLabel} (no activity snapshots yet for current week ${calendarWeekLabel})`
        : `${scopeLabel} · Week of ${reportingWeekLabel}`

      pdf = exportTradeCenterAnalyticsToPDF(payload, {
        title: "Trade Center — Student analytics",
        subtitle,
        coverLines: archiveMeta.coverLines,
        primaryColor: [13, 148, 136],
        includeTimestamp: true,
        includePageNumbers: true,
        sectionScopeLabel: scopeLabel,
      })
    } else if (reportKey === "trade-log") {
      const logPayload = await loadInstructorTradeLogPayload(
        scope.course.id,
        sessionForScopedQueries,
        300,
      )
      pdf = exportTradeCenterTradeLogToPDF(logPayload, {
        title: "Trade Center — Trade log",
        subtitle: `${scopeLabel} · Transactions, rollovers, and requests (newest first; capped per category)`,
        coverLines: archiveMeta.coverLines,
        primaryColor: [13, 148, 136],
        includeTimestamp: true,
        includePageNumbers: true,
        sectionScopeLabel: scopeLabel,
      })
    } else if (reportKey === "rollovers") {
      const merged = await fetchMergedRolloverRows(scope.course.id)
      const filtered = filterRolloverRows(merged, sessionForScopedQueries, search)
      const cap = 300
      const capped = filtered.slice(0, cap)
      const trades = capped.map((r, i) => mapRolloverRowToTrade(r, i))
      const filterCaption =
        search || sessionForScopedQueries
          ? `Filters: ${sessionForScopedQueries ? `session ${sessionForScopedQueries}` : "all sessions"}${search ? ` · search “${search.slice(0, 80)}”` : ""}`
          : undefined
      const totalNote =
        filtered.length > cap ? `Showing ${cap} of ${filtered.length} matching rows.` : `${filtered.length} row(s).`

      pdf = exportTradeCenterRolloversToPDF(trades, {
        title: "Trade Center — Rollover trades",
        subtitle: `${scopeLabel} · ${totalNote}`,
        filterCaption,
        coverLines: archiveMeta.coverLines,
        primaryColor: [13, 148, 136],
        includeTimestamp: true,
        includePageNumbers: true,
        sectionScopeLabel: scopeLabel,
      })
    } else {
      const hubPayload = await loadInstructorDonationsHubPendingPayload(scope.course.id)
      pdf = exportTradeCenterDonationsHubToPDF(hubPayload.donationRequests, hubPayload.pointRequests, {
        title: "Trade Center — Donations & point requests",
        subtitle: `${scopeLabel} · Pending donation transfers and peer point requests awaiting instructor action`,
        coverLines: archiveMeta.coverLines,
        primaryColor: [13, 148, 136],
        includeTimestamp: true,
        includePageNumbers: true,
        sectionScopeLabel: scopeLabel,
      })
    }

    const pdfBlob = pdf.output("blob")
    const arrayBuffer = await pdfBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const safeName = `${archiveMeta.filenameStem}.pdf`.replace(/[^\w.\-()+]+/g, "-")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    console.error("[Trade Center Export] Error:", error)
    const message = error instanceof Error ? error.message : "Export failed"
    return NextResponse.json(
      { error: "Failed to export trade center report", details: message },
      { status: 500 },
    )
  }
}
