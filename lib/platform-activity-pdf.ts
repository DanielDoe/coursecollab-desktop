import { jsPDF } from "jspdf"
import { pdfSplitLines, sanitizePdfPlainText } from "@/lib/pdf-text-sanitize"
import type { PlatformActivityRow } from "@/lib/platform-activity-constants"
import {
  categoryLabel,
  clientPlatformLabel,
  formatActivityActorPrimary,
  formatActivityActorSecondary,
  portalLabel,
  resolveActivityClientPlatform,
} from "@/lib/platform-activity-constants"

export type PlatformActivityPdfFilters = {
  portal?: string
  category?: string
  clientPlatform?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function exportPlatformActivityPdf(
  logs: PlatformActivityRow[],
  filters: PlatformActivityPdfFilters,
  options?: { title?: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const title = options?.title ?? "Platform Activity Report"

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(sanitizePdfPlainText(title), margin, margin)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  let y = margin + 18
  doc.text(`Generated: ${formatTs(new Date().toISOString())}`, margin, y)
  y += 12
  doc.text(`Records: ${logs.length}`, margin, y)
  y += 12

  const filterParts: string[] = []
  if (filters.portal && filters.portal !== "all") filterParts.push(`Portal: ${portalLabel(filters.portal)}`)
  if (filters.category && filters.category !== "all")
    filterParts.push(`Category: ${categoryLabel(filters.category)}`)
  if (filters.clientPlatform && filters.clientPlatform !== "all") {
    filterParts.push(
      `Client: ${clientPlatformLabel(
        filters.clientPlatform === "mobile" ||
          filters.clientPlatform === "desktop" ||
          filters.clientPlatform === "web"
          ? filters.clientPlatform
          : null,
      )}`,
    )
  }
  if (filters.dateFrom) filterParts.push(`From: ${filters.dateFrom}`)
  if (filters.dateTo) filterParts.push(`To: ${filters.dateTo}`)
  if (filters.search) filterParts.push(`Search: ${filters.search}`)
  if (filterParts.length) {
    for (const line of pdfSplitLines(doc, filterParts.join(" · "), pageW - margin * 2)) {
      y += 12
      doc.text(line, margin, y)
    }
  }

  y += 20
  const cols = [
    { label: "Time", w: 90 },
    { label: "Portal", w: 48 },
    { label: "Client", w: 58 },
    { label: "User", w: 85 },
    { label: "Action", w: 70 },
    { label: "Category", w: 58 },
    { label: "Summary", w: 175 },
    { label: "Path", w: 100 },
    { label: "OK", w: 25 },
  ]

  const drawHeader = (startY: number) => {
    doc.setFillColor(99, 102, 241)
    doc.rect(margin, startY, pageW - margin * 2, 16, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    let x = margin + 4
    for (const col of cols) {
      doc.text(col.label, x, startY + 11)
      x += col.w
    }
    doc.setTextColor(0, 0, 0)
    doc.setFont("helvetica", "normal")
    return startY + 20
  }

  y = drawHeader(y)

  for (let i = 0; i < logs.length; i++) {
    const row = logs[i]
    const rowH = 28
    if (y + rowH > pageH - margin) {
      doc.addPage()
      y = drawHeader(margin)
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 2, pageW - margin * 2, rowH, "F")
    }

    doc.setFontSize(6.5)
    let x = margin + 4
    const cells = [
      formatTs(row.created_at),
      portalLabel(row.portal),
      clientPlatformLabel(resolveActivityClientPlatform(row)),
      sanitizePdfPlainText(
        [
          formatActivityActorPrimary(row),
          formatActivityActorSecondary(row) !== portalLabel(row.portal)
            ? formatActivityActorSecondary(row)
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      sanitizePdfPlainText(row.action),
      categoryLabel(row.category),
      sanitizePdfPlainText(row.summary ?? ""),
      sanitizePdfPlainText(row.path ?? ""),
      row.success ? "Yes" : "No",
    ]

    for (let c = 0; c < cols.length; c++) {
      const lines = pdfSplitLines(doc, cells[c], cols[c].w - 4)
      doc.text(lines.slice(0, 2), x, y + 8)
      x += cols[c].w
    }

    y += rowH
  }

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin - 60, pageH - 20)
  }

  doc.save(`platform-activity-${new Date().toISOString().slice(0, 10)}.pdf`)
}
