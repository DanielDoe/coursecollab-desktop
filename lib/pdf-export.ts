/**
 * PDF Export Utility
 * 
 * Provides well-designed PDF export functionality for various modules
 * (Groups, Projects, Students, etc.)
 */

import { jsPDF } from "jspdf"
import { pdfSplitLines, sanitizePdfPlainText } from "@/lib/pdf-text-sanitize"
import type { TradeCenterAnalyticsPayload } from "@/lib/trade-center-analytics-query"
import type { InstructorTradeLogPayload } from "@/lib/trade-center-instructor-trade-log-data"
import type { RolloverTradeRow } from "@/lib/trade-center-rollover-trades-query"
import type { AttendanceGradebookExportRow } from "@/lib/attendance-gradebook-rows-query"

export interface StudentData {
  id: number
  full_name: string
  student_id: string
  section?: string
  email?: string
  phone?: string
  [key: string]: any
}

export interface GroupData {
  id: number
  name: string
  session: string
  status?: string
  leader?: StudentData
  members?: StudentData[]
  created_at?: string
  [key: string]: any
}

export interface ProjectPresentationSlot {
  scheduled_date?: string | null
  start_time?: string | null
  end_time?: string | null
  status?: string | null
}

export interface ProjectData {
  id: number
  title: string
  project_link?: string | null
  summary?: string
  deliverables?: string
  target_platform?: string
  status?: string
  timeline?: any
  rejection_reason?: string | null
  group?: GroupData
  leader?: StudentData
  members?: StudentData[]
  created_at?: string
  updated_at?: string
  /** Booked presentation slots (non-cancelled) from project_presentations */
  presentations?: ProjectPresentationSlot[]
  [key: string]: any
}

export interface PDFExportOptions {
  title: string
  subtitle?: string
  /** Extra centered lines on the cover (course, section name, semester/year). */
  coverLines?: string[]
  primaryColor?: [number, number, number]
  includeTimestamp?: boolean
  includePageNumbers?: boolean
  orientation?: "portrait" | "landscape"
  /** When exporting for one session, optional configured presentation window from presentation_config */
  presentationWindow?: {
    session: string
    startDate: string
    endDate: string
  }
  /** Trade Center PDF: human-readable roster scope */
  sectionScopeLabel?: string
}

/**
 * Create a well-designed PDF with header and styling
 */
export function createPDFDocument(options: PDFExportOptions): jsPDF {
  const {
    title,
    subtitle,
    primaryColor = [76, 29, 149], // Default purple
    orientation = "portrait",
    coverLines: coverLinesRaw,
  } = options

  const pdf = new jsPDF(orientation, "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin

  const coverLines = (coverLinesRaw || []).map((l) => sanitizePdfPlainText(l)).filter(Boolean)

  const titleLines = pdfSplitLines(pdf, sanitizePdfPlainText(title || "Report"), contentWidth - 10)
  const subtitleText = subtitle?.trim() ? sanitizePdfPlainText(subtitle) : ""
  const subtitleLines = subtitleText ? pdfSplitLines(pdf, subtitleText, contentWidth - 10) : []

  const coverRendered: string[] = []
  for (const cl of coverLines) {
    coverRendered.push(...pdfSplitLines(pdf, cl, contentWidth - 10))
  }

  const titleLineH = 7
  const subLineH = 5.3
  const coverLineH = 4.9
  const topPad = 9
  let headerH =
    topPad +
    titleLines.length * titleLineH +
    (subtitleLines.length ? subtitleLines.length * subLineH + 4 : 0) +
    (coverRendered.length ? coverRendered.length * coverLineH + 8 : 0) +
    10
  headerH = Math.min(100, Math.max(40, headerH))

  // Store page dimensions and helpers in PDF object for later use
  ;(pdf as any).__pageWidth = pageWidth
  ;(pdf as any).__pageHeight = pageHeight
  ;(pdf as any).__margin = margin
  ;(pdf as any).__contentWidth = contentWidth
  ;(pdf as any).__yPos = headerH + 10 // Start after header

  const metaSubject = [subtitleText, ...coverLines].filter(Boolean).join(" · ")
  try {
    pdf.setProperties({
      title: sanitizePdfPlainText(title).slice(0, 120),
      subject: metaSubject.slice(0, 240),
    })
  } catch {
    /* jsPDF build without setProperties */
  }

  // === HEADER SECTION ===
  pdf.setFillColor(...primaryColor)
  pdf.rect(0, 0, pageWidth, headerH, "F")

  pdf.setTextColor(255, 255, 255)
  let y = topPad + 5
  pdf.setFontSize(22)
  pdf.setFont("helvetica", "bold")
  for (const tl of titleLines) {
    pdf.text(tl, pageWidth / 2, y, { align: "center" })
    y += titleLineH
  }

  if (subtitleLines.length > 0) {
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(248, 248, 252)
    y += 2
    for (const sl of subtitleLines) {
      pdf.text(sl, pageWidth / 2, y, { align: "center" })
      y += subLineH
    }
  }

  if (coverRendered.length > 0) {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(235, 235, 245)
    y += 4
    for (const cl of coverRendered) {
      pdf.text(cl, pageWidth / 2, y, { align: "center" })
      y += coverLineH
    }
  }

  // Footer with timestamp
  if (options.includeTimestamp !== false) {
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.setFont("helvetica", "normal")
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    })
    pdf.text(`Generated: ${timestamp}`, pageWidth / 2, pageHeight - 10, { align: "center" })
  }

  return pdf
}

/**
 * Add a section header to the PDF
 */
export function addSectionHeader(
  pdf: jsPDF,
  title: string,
  color: [number, number, number] = [30, 41, 59]
): number {
  const yPos = (pdf as any).__yPos || 50
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180

  // Add spacing before section
  const newYPos = yPos + 10

  // Section background
  pdf.setFillColor(248, 250, 252)
  pdf.rect(margin, newYPos, contentWidth, 12, "F")

  // Section title
  pdf.setTextColor(...color)
  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.text(title, margin + 5, newYPos + 8)

  ;(pdf as any).__yPos = newYPos + 20
  return (pdf as any).__yPos
}

/**
 * Add student information table
 */
export function addStudentTable(
  pdf: jsPDF,
  students: StudentData[],
  columns: { key: string; label: string; width?: number }[] = [
    { key: "student_id", label: "Student ID", width: 40 },
    { key: "full_name", label: "Name", width: 80 },
    { key: "section", label: "Section", width: 30 },
    { key: "email", label: "Email", width: 50 }
  ]
): void {
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos || 50
  const pageHeight = (pdf as any).__pageHeight || 297

  // Table header
  pdf.setFillColor(71, 85, 105) // Slate-600
  pdf.rect(margin, yPos, contentWidth, 10, "F")

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "bold")

  let xPos = margin + 3
  columns.forEach((col) => {
    pdf.text(col.label, xPos, yPos + 7)
    xPos += col.width || 45
  })

  yPos += 10

  // Table rows
  pdf.setTextColor(30, 41, 59) // Slate-800
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)

  students.forEach((student, index) => {
    // Check if we need a new page
    if (yPos + 8 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50

      // Redraw header on new page
      pdf.setFillColor(71, 85, 105)
      pdf.rect(margin, yPos, contentWidth, 10, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      xPos = margin + 3
      columns.forEach((col) => {
        pdf.text(col.label, xPos, yPos + 7)
        xPos += col.width || 45
      })
      yPos += 10
      pdf.setTextColor(30, 41, 59)
      pdf.setFont("helvetica", "normal")
    }

    // Alternate row colors
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, yPos, contentWidth, 8, "F")
    }

    xPos = margin + 3
    columns.forEach((col) => {
      const value = student[col.key] || "-"
      pdf.text(String(value).substring(0, 30), xPos, yPos + 6)
      xPos += col.width || 45
    })

    yPos += 8
  })

  ;(pdf as any).__yPos = yPos + 5
}

/**
 * Add group information to PDF
 */
export function addGroupSection(
  pdf: jsPDF,
  group: GroupData,
  includeMembers: boolean = true
): void {
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos || 50
  const pageHeight = (pdf as any).__pageHeight || 297

  // Check page break
  if (yPos + 60 > pageHeight - 20) {
    pdf.addPage()
    yPos = 50
  }

  // Group info box
  pdf.setFillColor(248, 250, 252)
  pdf.rect(margin, yPos, contentWidth, 50, "F")
  pdf.setDrawColor(226, 232, 240)
  pdf.rect(margin, yPos, contentWidth, 50, "S")

  pdf.setTextColor(30, 41, 59)
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text(sanitizePdfPlainText(group.name), margin + 5, yPos + 8)

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Session: ${sanitizePdfPlainText(group.session)}`, margin + 5, yPos + 15)
  if (group.status) {
    pdf.text(`Status: ${sanitizePdfPlainText(group.status)}`, margin + 5, yPos + 22)
  }
  if (group.leader) {
    pdf.text(
      `Leader: ${sanitizePdfPlainText(group.leader.full_name)} (${sanitizePdfPlainText(String(group.leader.student_id))})`,
      margin + 5,
      yPos + 29,
    )
  }
  if (group.created_at) {
    const date = new Date(group.created_at).toLocaleDateString()
    pdf.text(`Created: ${date}`, margin + 5, yPos + 36)
  }

  yPos += 55

  // Members section
  if (includeMembers && group.members && group.members.length > 0) {
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.text("Members:", margin + 5, yPos)
    yPos += 8

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")

    group.members.forEach((member, index) => {
      if (yPos + 6 > pageHeight - 20) {
        pdf.addPage()
        yPos = 50
      }

      pdf.text(`  • ${sanitizePdfPlainText(member.full_name)} (${sanitizePdfPlainText(String(member.student_id))})`, margin + 5, yPos)
      yPos += 6
    })

    yPos += 5
  }

  ;(pdf as any).__yPos = yPos
}

function formatPdfDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—"
  try {
    const d = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 32)
    return d.toLocaleDateString("en-US", {
      dateStyle: "medium",
      timeZone: "America/Chicago",
    })
  } catch {
    return String(value).slice(0, 32)
  }
}

function formatPdfDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—"
  try {
    const d = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 40)
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    })
  } catch {
    return String(value).slice(0, 40)
  }
}

function tradeLogTransactionTypeLabel(t: unknown): string {
  const u = String(t || "").toUpperCase()
  if (u === "TRADE") return "Trade→EC"
  if (u === "DONATION") return "Donation"
  return u ? u.slice(0, 14) : "—"
}

function tradeLogHumanizeStatus(s: unknown): string {
  const raw = String(s || "").trim()
  if (!raw) return "—"
  return raw
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ")
}

function tradeLogFormatCategory(cat: unknown): string {
  const c = String(cat || "").trim()
  if (!c) return "—"
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}

function drawPdfLines(
  pdf: jsPDF,
  lines: string[],
  x: number,
  yStart: number,
  lineHeightMm: number,
): number {
  let y = yStart
  for (const line of lines) {
    pdf.text(line, x, y)
    y += lineHeightMm
  }
  return y
}

function normalizeUrlForPdf(href: string): string {
  const t = href.trim()
  if (!t) return ""
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function formatTimelineValue(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "string") return sanitizePdfPlainText(v)
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  try {
    return sanitizePdfPlainText(JSON.stringify(v))
  } catch {
    return "—"
  }
}

function formatTimelineEntry(item: unknown, index: number): string {
  if (item == null) return `${index}. —`
  if (typeof item === "string") {
    const s = sanitizePdfPlainText(item)
    return s ? `${index}. ${s}` : `${index}. —`
  }
  if (typeof item === "object") {
    const o = item as Record<string, unknown>
    const title =
      o.title ?? o.name ?? o.label ?? o.milestone ?? o.description ?? o.task
    const date = o.date ?? o.due ?? o.due_date ?? o.start ?? o.end
    const parts: string[] = []
    if (title != null && String(title).trim()) parts.push(sanitizePdfPlainText(String(title)))
    if (date != null && String(date).trim()) parts.push(sanitizePdfPlainText(String(date)))
    if (parts.length > 0) return `${index}. ${parts.join(" · ")}`
    const flat = formatTimelineValue(o)
    return flat && flat !== "{}" ? `${index}. ${flat}` : `${index}. (entry)`
  }
  return `${index}. ${sanitizePdfPlainText(String(item))}`
}

function formatTimelineForPdf(timeline: unknown): string {
  if (timeline == null || timeline === "") return ""
  if (typeof timeline === "string") {
    const t = timeline.trim()
    if (!t || t === "[]" || t === "{}") return ""
    return sanitizePdfPlainText(t)
  }
  if (Array.isArray(timeline)) {
    if (timeline.length === 0) return ""
    return timeline.map((item, i) => formatTimelineEntry(item, i + 1)).join("\n")
  }
  if (typeof timeline === "object") {
    const o = timeline as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 0) return ""
    return keys.map((k) => `${sanitizePdfPlainText(k)}: ${formatTimelineValue(o[k])}`).join("\n")
  }
  return sanitizePdfPlainText(String(timeline))
}

/** Short overview-cell text for booked presentations */
function presentationsSummaryOneLine(slots: ProjectPresentationSlot[] | undefined): string {
  if (!slots?.length) return "—"
  const parts = slots.slice(0, 2).map((s) => {
    const d = formatPdfDate(s.scheduled_date as string | undefined)
    const t = s.start_time != null ? String(s.start_time).slice(0, 8) : ""
    return t ? `${d} ${t}` : d
  })
  const extra = slots.length > 2 ? ` (+${slots.length - 2})` : ""
  return `${parts.join(" · ")}${extra}`
}

/**
 * Rich project block: group, roster, description, deliverables, link, timeline, presentation bookings.
 */
export function addProjectSection(
  pdf: jsPDF,
  project: ProjectData,
  includeDetails: boolean = true
): void {
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  const pageHeight = (pdf as any).__pageHeight || 297
  const innerW = contentWidth - 14
  let yPos = (pdf as any).__yPos || 50

  const ensureSpace = (neededMm: number) => {
    if (yPos + neededMm > pageHeight - margin) {
      pdf.addPage()
      yPos = 50
    }
  }

  ensureSpace(28)

  const titleRaw = sanitizePdfPlainText(project.title || "Untitled project") || "Untitled project"
  pdf.setFontSize(13)
  pdf.setFont("helvetica", "bold")
  const titleLines = pdfSplitLines(pdf, titleRaw, innerW)

  // Title + accent
  pdf.setFillColor(254, 226, 226)
  pdf.rect(margin, yPos, 3.5, 10 + titleLines.length * 5.2, "F")

  pdf.setTextColor(127, 29, 29)
  pdf.setFontSize(13)
  pdf.setFont("helvetica", "bold")
  pdf.text(titleLines, margin + 9, yPos + 6)
  yPos += 8 + titleLines.length * 5.2 + 8

  pdf.setFontSize(9.5)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(51, 65, 85)

  const metaRows: { label: string; value: string }[] = []
  if (project.group?.name) metaRows.push({ label: "Group", value: sanitizePdfPlainText(project.group.name) })
  if (project.group?.session)
    metaRows.push({ label: "Section", value: sanitizePdfPlainText(project.group.session) })
  if (project.group?.id != null) metaRows.push({ label: "Group ID", value: String(project.group.id) })
  if (project.group?.status)
    metaRows.push({ label: "Group status", value: sanitizePdfPlainText(project.group.status) })
  if (project.status) metaRows.push({ label: "Project status", value: sanitizePdfPlainText(project.status) })
  if (project.id != null) metaRows.push({ label: "Project ID", value: String(project.id) })

  const labelCol = 34
  const metaLineH = 5.2
  let metaBlockH = 6
  for (const row of metaRows) {
    const vLines = pdfSplitLines(pdf, row.value, innerW - labelCol - 14)
    metaBlockH += Math.max(1, vLines.length) * metaLineH + 2
  }
  ensureSpace(metaBlockH + 10)

  pdf.setFillColor(248, 250, 252)
  pdf.setDrawColor(226, 232, 240)
  pdf.rect(margin + 9, yPos, innerW, metaBlockH, "FD")

  let metaY = yPos + 5
  const metaLeft = margin + 11
  const metaValX = metaLeft + labelCol
  for (const row of metaRows) {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.setTextColor(51, 65, 85)
    pdf.text(`${row.label}:`, metaLeft, metaY)
    pdf.setFont("helvetica", "normal")
    const vLines = pdfSplitLines(pdf, row.value, innerW - labelCol - 14)
    metaY = drawPdfLines(pdf, vLines, metaValX, metaY, metaLineH)
    metaY += 2
  }
  yPos += metaBlockH + 8

  if (!includeDetails) {
    ;(pdf as any).__yPos = yPos + 4
    return
  }

  pdf.setTextColor(30, 41, 59)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  ensureSpace(12)
  pdf.text("Team roster", margin + 9, yPos)
  yPos += 7

  type RosterPerson = { role: string; name: string; sid: string; section: string; email: string }
  const rosterPeople: RosterPerson[] = []
  if (project.leader) {
    const L = project.leader
    rosterPeople.push({
      role: "Leader",
      name: sanitizePdfPlainText(L.full_name || ""),
      sid: sanitizePdfPlainText(String(L.student_id || "")),
      section: L.section ? sanitizePdfPlainText(L.section) : "",
      email: L.email ? sanitizePdfPlainText(L.email) : "",
    })
  }
  const rosterOthers = (project.members || []).filter((m) => !project.leader || m.id !== project.leader.id)
  for (const m of rosterOthers) {
    rosterPeople.push({
      role: "Member",
      name: sanitizePdfPlainText(m.full_name || ""),
      sid: sanitizePdfPlainText(String(m.student_id || "")),
      section: m.section ? sanitizePdfPlainText(m.section) : "",
      email: m.email ? sanitizePdfPlainText(m.email) : "",
    })
  }

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  if (rosterPeople.length === 0) {
    ensureSpace(6)
    pdf.setTextColor(100, 116, 139)
    pdf.text("No members listed.", margin + 11, yPos)
    yPos += 8
  } else {
    rosterPeople.forEach((p, idx) => {
      ensureSpace(26)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(30, 41, 59)
      pdf.text(`${idx + 1}. ${p.role}`, margin + 11, yPos)
      yPos += 5.2
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(55, 65, 81)
      const nameLine = `${p.name || "—"} · ID ${p.sid || "—"}`
      yPos = drawPdfLines(pdf, pdfSplitLines(pdf, nameLine, innerW - 8), margin + 14, yPos, 4.8)
      if (p.section) {
        yPos = drawPdfLines(
          pdf,
          pdfSplitLines(pdf, `Section: ${p.section}`, innerW - 8),
          margin + 14,
          yPos,
          4.8,
        )
      }
      if (p.email) {
        yPos = drawPdfLines(pdf, pdfSplitLines(pdf, `Email: ${p.email}`, innerW - 8), margin + 14, yPos, 4.8)
      }
      yPos += 5
    })
  }
  yPos += 4

  const writeBlock = (heading: string, text: string | undefined | null, bodyFontSize = 9.5) => {
    const body = sanitizePdfPlainText((text || "").trim())
    if (!body) return
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(30, 41, 59)
    ensureSpace(12)
    pdf.text(heading, margin + 9, yPos)
    yPos += 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(bodyFontSize)
    pdf.setTextColor(55, 65, 81)
    const lines = pdfSplitLines(pdf, body, innerW)
    const lh = bodyFontSize === 8 ? 4.2 : 4.8
    for (const line of lines) {
      ensureSpace(lh + 2)
      pdf.text(line, margin + 9, yPos)
      yPos += lh
    }
    yPos += 5
  }

  writeBlock("Description / summary", project.summary)
  writeBlock("Deliverables", project.deliverables)

  if (project.target_platform?.trim()) {
    writeBlock("Target platform", project.target_platform)
  }

  if (project.project_link?.trim()) {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(30, 41, 59)
    ensureSpace(12)
    pdf.text("Project link", margin + 9, yPos)
    yPos += 6
    const raw = project.project_link.trim()
    const href = normalizeUrlForPdf(raw)
    const display = sanitizePdfPlainText(raw)
    pdf.setFont("courier", "normal")
    pdf.setFontSize(8.5)
    const linkLines = pdfSplitLines(pdf, display, innerW)
    const linkLineH = 4.6
    for (const ln of linkLines) {
      ensureSpace(linkLineH + 2)
      pdf.setTextColor(0, 70, 180)
      pdf.text(ln, margin + 9, yPos)
      const w = pdf.getTextWidth(ln)
      pdf.link(margin + 9, yPos - 3.8, Math.min(w + 1, innerW), 5.2, { url: href })
      yPos += linkLineH
    }
    pdf.setFont("helvetica", "normal")
    yPos += 5
    pdf.setTextColor(55, 65, 81)
  }

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.setTextColor(30, 41, 59)
  ensureSpace(14)
  pdf.text("Timeline / milestones", margin + 9, yPos)
  yPos += 6
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8.5)
  pdf.setTextColor(55, 65, 81)
  const timelineStr = formatTimelineForPdf(project.timeline)
  if (!timelineStr.trim()) {
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(100, 116, 139)
    ensureSpace(6)
    pdf.text("No milestones recorded.", margin + 9, yPos)
    yPos += 8
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(55, 65, 81)
  } else {
    const tlLines = pdfSplitLines(pdf, timelineStr, innerW)
    yPos = drawPdfLines(pdf, tlLines, margin + 9, yPos, 4.5)
    yPos += 5
  }

  // Presentation bookings
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(10)
  pdf.setTextColor(30, 41, 59)
  ensureSpace(12)
  pdf.text("Presentation schedule", margin + 9, yPos)
  yPos += 6
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  const slots = project.presentations || []
  if (slots.length === 0) {
    pdf.setTextColor(100, 116, 139)
    ensureSpace(6)
    pdf.text("No booked presentation slots (or none active).", margin + 9, yPos)
    yPos += 8
  } else {
    pdf.setTextColor(55, 65, 81)
    slots.forEach((s, i) => {
      const d = formatPdfDate(s.scheduled_date as string | undefined)
      const start = s.start_time != null ? String(s.start_time) : ""
      const end = s.end_time != null ? String(s.end_time) : ""
      const timePart = start && end ? `${start} – ${end}` : start || end || ""
      const st = sanitizePdfPlainText(s.status || "scheduled")
      const line = `${i + 1}. ${d}${timePart ? ` · ${timePart}` : ""} · ${st}`
      const lines = pdfSplitLines(pdf, line, innerW)
      for (const seg of lines) {
        ensureSpace(5.5)
        pdf.text(seg, margin + 9, yPos)
        yPos += 5
      }
    })
    yPos += 4
  }

  if (project.rejection_reason?.trim()) {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(185, 28, 28)
    ensureSpace(12)
    pdf.text("Rejection / revision notes", margin + 9, yPos)
    yPos += 6
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    const rr = sanitizePdfPlainText(project.rejection_reason.trim())
    const rejLines = pdfSplitLines(pdf, rr, innerW)
    for (const seg of rejLines) {
      ensureSpace(5.5)
      pdf.text(seg, margin + 9, yPos)
      yPos += 5
    }
    yPos += 4
    pdf.setTextColor(55, 65, 81)
  }

  pdf.setFontSize(8)
  pdf.setTextColor(148, 163, 184)
  const created = project.created_at ? formatPdfDate(project.created_at) : "—"
  const updated = project.updated_at ? formatPdfDate(project.updated_at) : "—"
  ensureSpace(8)
  pdf.text(`Record: created ${created} · updated ${updated}`, margin + 9, yPos)
  yPos += 10

  ;(pdf as any).__yPos = yPos + 4
}

/**
 * Add page numbers to PDF
 */
export function addPageNumbers(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages()
  const pageWidth = (pdf as any).__pageWidth || 210
  const pageHeight = (pdf as any).__pageHeight || 297

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" })
  }
}

/**
 * Add a table for groups with group name, session, and members (leader highlighted)
 */
function addGroupsTable(
  pdf: jsPDF,
  groups: GroupData[]
): void {
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos || 50
  const pageHeight = (pdf as any).__pageHeight || 297

  groups.forEach((group, groupIndex) => {
    // Check if we need a new page
    const estimatedHeight = 15 + (group.members?.length || 0) * 7
    if (yPos + estimatedHeight > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }

    // Group header row with name and session
    pdf.setFillColor(76, 29, 149) // Purple header
    pdf.rect(margin, yPos, contentWidth, 10, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")

    pdf.text(sanitizePdfPlainText(group.name || "Unnamed Group"), margin + 3, yPos + 7)
    
    const sessionText = `Session: ${sanitizePdfPlainText(group.session || "-")}`
    const sessionWidth = pdf.getTextWidth(sessionText)
    pdf.text(sessionText, margin + contentWidth - sessionWidth - 3, yPos + 7)

    yPos += 12

    // Members section
    if (group.members && group.members.length > 0) {
      // Table header for members
      pdf.setFillColor(71, 85, 105) // Slate-600
      pdf.rect(margin, yPos, contentWidth, 8, "F")

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      pdf.text("Members", margin + 3, yPos + 6)

      yPos += 8

      // Members list
      pdf.setTextColor(30, 41, 59) // Slate-800
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)

      // Add leader first (highlighted)
      if (group.leader) {
        // Highlight leader row
        pdf.setFillColor(255, 243, 205) // Light yellow background
        pdf.rect(margin, yPos, contentWidth, 7, "F")

        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(76, 29, 149) // Purple text for leader
        const leaderText = `${sanitizePdfPlainText(group.leader.full_name)} (${sanitizePdfPlainText(String(group.leader.student_id))}) — Leader`
        pdf.text(leaderText, margin + 3, yPos + 5)
        yPos += 7
      }

      // Add other members
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(30, 41, 59)

      group.members.forEach((member, memberIndex) => {
        // Skip if this member is the leader (already shown)
        if (group.leader && member.id === group.leader.id) {
          return
        }

        // Check page break
        if (yPos + 7 > pageHeight - 20) {
          pdf.addPage()
          yPos = 50
        }

        // Alternate row colors
        if (memberIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, yPos, contentWidth, 7, "F")
        }

        const memberText = `  • ${sanitizePdfPlainText(member.full_name)} (${sanitizePdfPlainText(String(member.student_id))})`
        pdf.text(memberText, margin + 3, yPos + 5)
        yPos += 7
      })
    } else {
      // No members
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "italic")
      pdf.text("No members", margin + 3, yPos + 5)
      yPos += 7
    }

    // Add spacing between groups
    yPos += 5
  })

  ;(pdf as any).__yPos = yPos
}

/**
 * Export groups data to PDF with table format
 */
export function exportGroupsToPDF(
  groups: GroupData[],
  options: PDFExportOptions = { title: "Groups Report" }
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || [76, 29, 149]
  })

  // Add summary section
  const margin = (pdf as any).__margin || 15
  let yPos = 50

  pdf.setTextColor(30, 41, 59)
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text(`Groups Report (${groups.length} total)`, margin, yPos)
  yPos += 10

  if (options.subtitle) {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    pdf.text(options.subtitle, margin, yPos)
    yPos += 8
  }

  ;(pdf as any).__yPos = yPos

  // Add groups table
  addGroupsTable(pdf, groups)

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }

  return pdf
}

/**
 * Compact overview table (used before full project profiles).
 */
function addProjectsTable(
  pdf: jsPDF,
  projects: ProjectData[]
): void {
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos || 50
  const pageHeight = (pdf as any).__pageHeight || 297

  const colWidths = {
    groupName: 34,
    session: 20,
    projectTitle: 46,
    status: 22,
    presentation: 42,
    hasLink: 16,
  }

  const drawHeader = () => {
    pdf.setFillColor(71, 85, 105)
    pdf.rect(margin, yPos, contentWidth, 10, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    let xPos = margin + 2
    pdf.text("Group", xPos, yPos + 6.5)
    xPos += colWidths.groupName
    pdf.text("Session", xPos, yPos + 6.5)
    xPos += colWidths.session
    pdf.text("Project", xPos, yPos + 6.5)
    xPos += colWidths.projectTitle
    pdf.text("Status", xPos, yPos + 6.5)
    xPos += colWidths.status
    pdf.text("Presentation", xPos, yPos + 6.5)
    xPos += colWidths.presentation
    pdf.text("Link", xPos, yPos + 6.5)
    yPos += 10
  }

  drawHeader()

  pdf.setTextColor(30, 41, 59)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7.5)

  const rowH = 9

  projects.forEach((project, index) => {
    if (yPos + rowH > pageHeight - 18) {
      pdf.addPage()
      yPos = 50
      drawHeader()
      pdf.setTextColor(30, 41, 59)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.5)
    }

    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, yPos, contentWidth, rowH, "F")
    }

    let xPos = margin + 2
    const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

    pdf.text(truncate(sanitizePdfPlainText(project.group?.name || "-"), 26), xPos, yPos + 6)
    xPos += colWidths.groupName

    pdf.text(truncate(sanitizePdfPlainText(project.group?.session || "-"), 12), xPos, yPos + 6)
    xPos += colWidths.session

    const title = sanitizePdfPlainText(project.title || "-")
    pdf.text(truncate(title, 38), xPos, yPos + 6)
    xPos += colWidths.projectTitle

    pdf.text(truncate(sanitizePdfPlainText(project.status || "-"), 14), xPos, yPos + 6)
    xPos += colWidths.status

    const pres = presentationsSummaryOneLine(project.presentations)
    pdf.text(truncate(pres, 36), xPos, yPos + 6)
    xPos += colWidths.presentation

    pdf.text(project.project_link?.trim() ? "Yes" : "—", xPos, yPos + 6)

    yPos += rowH
  })

  ;(pdf as any).__yPos = yPos + 8
}

/**
 * Export projects: overview table + rich per-project sections (group, roster, description, presentations, etc.).
 */
export function exportProjectsToPDF(
  projects: ProjectData[],
  options: PDFExportOptions = { title: "Projects Report" }
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || [220, 38, 38]
  })

  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos ?? 50

  pdf.setTextColor(30, 41, 59)
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text(`Projects Report (${projects.length} total)`, margin, yPos)
  yPos += 10

  if (options.subtitle) {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    pdf.text(options.subtitle, margin, yPos)
    yPos += 8
  }

  if (options.presentationWindow) {
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(71, 85, 105)
    const w = options.presentationWindow
    const note = `Course presentation window (${w.session}): ${formatPdfDate(w.startDate)} – ${formatPdfDate(w.endDate)}. Booking dates and times for each team appear under “Presentation schedule” in the detailed sections below.`
    const lines = pdfSplitLines(pdf, note, contentWidth)
    yPos = drawPdfLines(pdf, lines, margin, yPos, 4.6)
    yPos += 8
  }

  ;(pdf as any).__yPos = yPos

  addSectionHeader(pdf, "At-a-glance", [220, 38, 38])
  addProjectsTable(pdf, projects)

  addSectionHeader(pdf, "Detailed project profiles", [220, 38, 38])
  projects.forEach((project, index) => {
    addProjectSection(pdf, project, true)
    if (index < projects.length - 1) {
      const y = (pdf as any).__yPos || 50
      ;(pdf as any).__yPos = y + 4
    }
  })

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }

  return pdf
}

/**
 * Export students data to PDF
 */
export function exportStudentsToPDF(
  students: StudentData[],
  options: PDFExportOptions = { title: "Students Report" }
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || [34, 197, 94]
  })

  addSectionHeader(pdf, `Students List (${students.length} total)`, [34, 197, 94])
  addStudentTable(pdf, students)

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }

  return pdf
}

/**
 * Export combined groups and projects data to PDF
 */
export function exportGroupsAndProjectsToPDF(
  groups: GroupData[],
  projects: ProjectData[],
  options: PDFExportOptions = { title: "Groups & Projects Report" }
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || [76, 29, 149]
  })

  // Groups section
  addSectionHeader(pdf, `Groups (${groups.length} total)`, [76, 29, 149])
  groups.forEach((group, index) => {
    addGroupSection(pdf, group, true)
    if (index < groups.length - 1) {
      const yPos = (pdf as any).__yPos || 50
      ;(pdf as any).__yPos = yPos + 5
    }
  })

  // Projects section (overview + rich detail — matches standalone projects export)
  if (options.presentationWindow) {
    const margin = (pdf as any).__margin || 15
    const contentWidth = (pdf as any).__contentWidth || 180
    const pageHeight = (pdf as any).__pageHeight || 297
    let yPos = (pdf as any).__yPos || 50
    if (yPos + 28 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(71, 85, 105)
    const w = options.presentationWindow
    const note = `Course presentation window (${w.session}): ${formatPdfDate(w.startDate)} – ${formatPdfDate(w.endDate)}. Listed below: configured booking dates/times per team where scheduled.`
    const lines = pdf.splitTextToSize(note, contentWidth)
    pdf.text(lines, margin, yPos)
    yPos += lines.length * 4.6 + 8
    ;(pdf as any).__yPos = yPos
  }

  addSectionHeader(pdf, `Projects (${projects.length} total) — at-a-glance`, [220, 38, 38])
  addProjectsTable(pdf, projects)

  addSectionHeader(pdf, `Projects — detailed profiles`, [220, 38, 38])
  projects.forEach((project, index) => {
    addProjectSection(pdf, project, true)
    if (index < projects.length - 1) {
      const yPos = (pdf as any).__yPos || 50
      ;(pdf as any).__yPos = yPos + 5
    }
  })

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }

  return pdf
}

const TRADE_CENTER_ACCENT: [number, number, number] = [13, 148, 136]

function addTradeCenterDataTable(
  pdf: jsPDF,
  headers: string[],
  colWidths: number[],
  rows: string[][],
): void {
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos || 50
  const pageHeight = (pdf as any).__pageHeight || 297
  const headerH = 9
  const rowH = 7

  const drawHeaderRow = (atY: number) => {
    pdf.setFillColor(71, 85, 105)
    pdf.rect(margin, atY, contentWidth, headerH, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    let x = margin + 3
    headers.forEach((h, i) => {
      pdf.text(sanitizePdfPlainText(h).slice(0, 24), x, atY + 6)
      x += colWidths[i] ?? 40
    })
  }

  if (yPos + headerH + rowH > pageHeight - 18) {
    pdf.addPage()
    yPos = 50
  }

  drawHeaderRow(yPos)
  yPos += headerH

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.setTextColor(30, 41, 59)

  rows.forEach((row, index) => {
    if (yPos + rowH > pageHeight - 18) {
      pdf.addPage()
      yPos = 50
      drawHeaderRow(yPos)
      yPos += headerH
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(30, 41, 59)
    }
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, yPos, contentWidth, rowH, "F")
    }
    let x = margin + 3
    row.forEach((cell, i) => {
      pdf.text(sanitizePdfPlainText(cell).slice(0, 52), x, yPos + 5)
      x += colWidths[i] ?? 40
    })
    yPos += rowH
  })

  ;(pdf as any).__yPos = yPos + 5
}

/**
 * Trade Center instructor analytics: mirrors dashboard summaries in printable form.
 */
export function exportTradeCenterAnalyticsToPDF(
  payload: TradeCenterAnalyticsPayload,
  options: PDFExportOptions = { title: "Trade Center Report" },
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || TRADE_CENTER_ACCENT,
  })

  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos ?? 50
  const pageHeight = (pdf as any).__pageHeight || 297

  const scopeLabel = options.sectionScopeLabel?.trim() || "All sections"
  const sectionScoped = scopeLabel !== "All sections"
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  const introParts = [
    `Scope: ${sanitizePdfPlainText(scopeLabel)}. Summary metrics use roster-linked activity points for the week starting ${formatPdfDate(payload.weekStartDate)}.`,
    payload.usedFallbackWeek
      ? `The current ISO week (${formatPdfDate(payload.calendarWeekStart)}) had no stored snapshots; figures below use the latest week with data.`
      : null,
    `Transaction totals include events from that week forward; the weekly trend covers the last six weeks.`,
  ].filter(Boolean) as string[]
  const intro = sanitizePdfPlainText(introParts.join(" "))
  const introLines = pdfSplitLines(pdf, intro, contentWidth)
  for (const line of introLines) {
    if (yPos + 5 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }
    pdf.text(line, margin, yPos)
    yPos += 4.9
  }
  yPos += 6
  ;(pdf as any).__yPos = yPos

  const st = payload.stats
  addSectionHeader(pdf, "Weekly summary", TRADE_CENTER_ACCENT)
  const summaryText = [
    `Students with activity this week: ${st.total_students}`,
    `Total engagement credits (sum): ${st.total_ec_earned.toFixed(1)}`,
    `Average EC per student: ${st.avg_ec_per_student.toFixed(2)}`,
    `Total points earned this week: ${Math.round(st.total_points_earned)}`,
    `Average points per student: ${st.avg_points_per_student.toFixed(1)}`,
    `Students at EC cap (≥10): ${st.students_at_cap}`,
  ].join("\n")
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(51, 65, 85)
  const sumLines = pdfSplitLines(pdf, sanitizePdfPlainText(summaryText), contentWidth)
  for (const line of sumLines) {
    if ((pdf as any).__yPos + 5 > pageHeight - 20) {
      pdf.addPage()
      ;(pdf as any).__yPos = 50
    }
    pdf.text(line, margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 4.8
  }
  ;(pdf as any).__yPos += 4

  const traders = (payload.topTraders || []) as Array<{
    full_name?: string
    student_number?: string
    section?: string
    engagement_credits?: number
    total_points?: number
    total_trades_count?: number
    total_donations_count?: number
  }>
  addSectionHeader(pdf, "Top traders (this week)", TRADE_CENTER_ACCENT)
  if (traders.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No trader data for this period.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    const rows = traders.map((t, i) => [
      String(i + 1),
      String(t.full_name ?? "—").slice(0, 42),
      String(t.engagement_credits ?? 0),
      String(Math.round(Number(t.total_points ?? 0))),
      String(t.total_trades_count ?? 0),
      String(t.total_donations_count ?? 0),
    ])
    addTradeCenterDataTable(
      pdf,
      ["#", "Name", "EC", "Pts", "Trades", "Don."],
      [12, 78, 16, 26, 26, 22],
      rows,
    )
  }

  const txs = (payload.transactions || []) as Array<{
    transaction_type?: string
    count?: number
    total_points?: number
    avg_points?: number
  }>
  addSectionHeader(pdf, "Transaction breakdown (from week start)", TRADE_CENTER_ACCENT)
  if (txs.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No recorded transactions in scope.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Type", "Count", "Total pts", "Avg pts"],
      [52, 38, 44, 46],
      txs.map((tx) => [
        String(tx.transaction_type ?? "—"),
        String(tx.count ?? 0),
        String(Math.round(Number(tx.total_points ?? 0))),
        Number(tx.avg_points ?? 0).toFixed(1),
      ]),
    )
  }

  const sessions = (payload.sessionBreakdown || []) as Array<{
    session?: string
    student_count?: number
    avg_ec?: number
    avg_points?: number
  }>
  addSectionHeader(pdf, "Session breakdown (activity bucket)", TRADE_CENTER_ACCENT)
  if (sessions.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No session breakdown rows.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Session", "Students", "Avg EC", "Avg pts"],
      [44, 36, 40, 60],
      sessions.map((s) => [
        String(s.session ?? "ALL"),
        String(s.student_count ?? 0),
        Number(s.avg_ec ?? 0).toFixed(2),
        Number(s.avg_points ?? 0).toFixed(1),
      ]),
    )
  }

  const overTime = (payload.tradesOverTime || []) as Array<{
    week_start?: string | Date
    total_points?: number
    trade_count?: number
    donation_count?: number
  }>
  addSectionHeader(pdf, "Points traded — last 6 weeks", TRADE_CENTER_ACCENT)
  if (overTime.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No trend data.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Week of", "Points", "Trades", "Donations"],
      [52, 42, 42, 44],
      overTime.map((w) => [
        formatPdfDate(w.week_start),
        String(Math.round(Number(w.total_points ?? 0))),
        String(w.trade_count ?? 0),
        String(w.donation_count ?? 0),
      ]),
    )
  }

  const low = (payload.lowEngagement || []) as Array<{
    full_name?: string
    student_number?: string
    section?: string
    weeks_with_zero_ec?: number
  }>
  addSectionHeader(pdf, "Low engagement watchlist", TRADE_CENTER_ACCENT)
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "italic")
  pdf.setTextColor(100, 116, 139)
  const note = "Students with zero EC across recent weekly snapshots (or no activity rows); capped at 20."
  const noteLines = pdfSplitLines(pdf, sanitizePdfPlainText(note), contentWidth)
  for (const nl of noteLines) {
    if ((pdf as any).__yPos + 4 > pageHeight - 20) {
      pdf.addPage()
      ;(pdf as any).__yPos = 50
    }
    pdf.text(nl, margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 4.3
  }
  ;(pdf as any).__yPos += 4
  pdf.setFont("helvetica", "normal")

  if (low.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No students matched the low-engagement criteria.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else if (sectionScoped) {
    addTradeCenterDataTable(
      pdf,
      ["Name", "Student ID", "Weeks @ 0 EC"],
      [78, 38, 64],
      low.map((s) => [
        String(s.full_name ?? "—").slice(0, 44),
        String(s.student_number ?? "—").slice(0, 16),
        String(s.weeks_with_zero_ec ?? 0),
      ]),
    )
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Name", "Student ID", "Section", "Weeks @ 0 EC"],
      [52, 30, 44, 54],
      low.map((s) => [
        String(s.full_name ?? "—").slice(0, 28),
        String(s.student_number ?? "—").slice(0, 14),
        String(s.section ?? "—").slice(0, 18),
        String(s.weeks_with_zero_ec ?? 0),
      ]),
    )
  }

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }

  return pdf
}

/**
 * Printable trade log: transactions, grade rollover trades, donation requests, point requests.
 */
export function exportTradeCenterTradeLogToPDF(
  payload: InstructorTradeLogPayload,
  options: PDFExportOptions = { title: "Trade Center — Trade log" },
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || TRADE_CENTER_ACCENT,
  })
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos ?? 50
  const pageHeight = (pdf as any).__pageHeight || 297
  const scopeLabel = options.sectionScopeLabel?.trim() || "All sections"

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  const intro = sanitizePdfPlainText(
    `Scope: ${scopeLabel}. Each table lists the newest records first (same caps as the on-screen trade log). Times are America/Chicago.`,
  )
  const introLines = pdfSplitLines(pdf, intro, contentWidth)
  for (const line of introLines) {
    if (yPos + 5 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }
    pdf.text(line, margin, yPos)
    yPos += 4.9
  }
  yPos += 4
  ;(pdf as any).__yPos = yPos

  const sectionScoped = scopeLabel !== "All sections"

  const tx = payload.transactions || []
  addSectionHeader(pdf, "Completed trades & transfers", TRADE_CENTER_ACCENT)
  if (tx.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No transactions for this filter.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else if (sectionScoped) {
    addTradeCenterDataTable(
      pdf,
      ["When", "Type", "Summary", "Pts", "EC"],
      [38, 22, 92, 14, 14],
      tx.map((row) => [
        formatPdfDateTime(row.created_at as string | undefined),
        tradeLogTransactionTypeLabel(row.transaction_type),
        String(row.summary || "—").slice(0, 72),
        row.points_used != null ? String(row.points_used) : "—",
        String(row.transaction_type || "").toUpperCase() === "TRADE" && row.credits_gained != null
          ? String(row.credits_gained)
          : "—",
      ]),
    )
  } else {
    addTradeCenterDataTable(
      pdf,
      ["When", "Sec", "Type", "Summary", "Pts", "EC"],
      [30, 22, 22, 76, 14, 16],
      tx.map((row) => [
        formatPdfDateTime(row.created_at as string | undefined),
        String(row.donor_section || row.session || "—").slice(0, 14),
        tradeLogTransactionTypeLabel(row.transaction_type),
        String(row.summary || "—").slice(0, 58),
        row.points_used != null ? String(row.points_used) : "—",
        String(row.transaction_type || "").toUpperCase() === "TRADE" && row.credits_gained != null
          ? String(row.credits_gained)
          : "—",
      ]),
    )
  }

  const ro = payload.rollovers || []
  addSectionHeader(pdf, "Grade rollover trades (trade log)", TRADE_CENTER_ACCENT)
  if (ro.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No rollover trades for this filter.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Student", "Assessment", "Cat", "Pts", "Applied"],
      [42, 70, 20, 12, 36],
      ro.map((row) => [
        String(row.student_name || "—").slice(0, 32),
        String(row.quiz_title || "—").slice(0, 52),
        tradeLogFormatCategory(row.source_category).slice(0, 14),
        row.points_deducted != null ? String(row.points_deducted) : "—",
        formatPdfDateTime(row.applied_at as string | undefined),
      ]),
    )
  }

  const dr = payload.donationRequests || []
  addSectionHeader(pdf, "Donation requests", TRADE_CENTER_ACCENT)
  if (dr.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No donation requests for this filter.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Requested", "Donor → Recipient", "Source", "Pts", "Status"],
      [34, 88, 28, 14, 16],
      dr.map((row) => [
        formatPdfDateTime(row.created_at as string | undefined),
        `${String(row.donor_name || "—").slice(0, 34)} → ${String(row.recipient_name || "—").slice(0, 34)}`,
        String((row as { source_label?: string }).source_label || row.source || "—").slice(0, 18),
        row.points != null ? String(row.points) : "—",
        tradeLogHumanizeStatus(row.status).slice(0, 16),
      ]),
    )
  }

  const pr = payload.pointRequests || []
  addSectionHeader(pdf, "Peer point requests", TRADE_CENTER_ACCENT)
  if (pr.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No point requests for this filter.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Requested", "Requester ← Peer", "Source", "Pts", "Status"],
      [34, 88, 28, 14, 16],
      pr.map((row) => [
        formatPdfDateTime(row.created_at as string | undefined),
        `${String(row.requester_name || "—").slice(0, 34)} ← ${String(row.requestee_name || "—").slice(0, 34)}`,
        String((row as { source_label?: string }).source_label || row.source || "—").slice(0, 18),
        row.points != null ? String(row.points) : "—",
        tradeLogHumanizeStatus(row.status).slice(0, 16),
      ]),
    )
  }

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }
  return pdf
}

/**
 * Rollover trades directory (merged points-traded + instructor-granted rows).
 */
export function exportTradeCenterRolloversToPDF(
  trades: RolloverTradeRow[],
  options: PDFExportOptions & { filterCaption?: string },
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || TRADE_CENTER_ACCENT,
  })
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos ?? 50
  const pageHeight = (pdf as any).__pageHeight || 297
  const scopeLabel = options.sectionScopeLabel?.trim() || "All sections"
  const filterNote = options.filterCaption?.trim()

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  const introParts = [
    `Scope: ${sanitizePdfPlainText(scopeLabel)}.`,
    filterNote ? sanitizePdfPlainText(filterNote) : null,
    "Includes point trades and instructor- or self-applied extensions; export is capped at 300 rows.",
  ].filter(Boolean) as string[]
  const introLines = pdfSplitLines(pdf, introParts.join(" "), contentWidth)
  for (const line of introLines) {
    if (yPos + 5 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }
    pdf.text(line, margin, yPos)
    yPos += 4.9
  }
  yPos += 4
  ;(pdf as any).__yPos = yPos

  addSectionHeader(pdf, "Rollover trades", TRADE_CENTER_ACCENT)
  if (trades.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No rollover trades matched the filters.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Student", "Tier", "Assignment", "Pts", "Src", "Hr", "Expires"],
      [38, 17, 54, 11, 15, 8, 37],
      trades.map((t) => [
        t.studentName.slice(0, 28),
        t.membershipTier.slice(0, 12),
        t.quizTitle.slice(0, 52),
        String(t.pointsTraded),
        t.sourceLabel.slice(0, 14),
        `${t.hours}h`,
        formatPdfDateTime(t.expiresAt),
      ]),
    )
  }

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }
  return pdf
}

/** Donations hub: donation + point request queues for the course roster. */
export function exportTradeCenterDonationsHubToPDF(
  donationRequests: Record<string, unknown>[],
  pointRequests: Record<string, unknown>[],
  options: PDFExportOptions = { title: "Trade Center — Donations & requests" },
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || TRADE_CENTER_ACCENT,
  })
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos ?? 50
  const pageHeight = (pdf as any).__pageHeight || 297

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  const intro = sanitizePdfPlainText(
    "Pending donation requests and peer point requests waiting on instructor approval (same queues as the Donations tab).",
  )
  const introLines = pdfSplitLines(pdf, intro, contentWidth)
  for (const line of introLines) {
    if (yPos + 5 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }
    pdf.text(line, margin, yPos)
    yPos += 4.9
  }
  yPos += 4
  ;(pdf as any).__yPos = yPos

  addSectionHeader(pdf, "Donation requests", TRADE_CENTER_ACCENT)
  if (donationRequests.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No donation requests on file.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["When", "Donor → Recipient", "Source", "Pts", "Status"],
      [34, 88, 28, 14, 16],
      donationRequests.map((row) => [
        formatPdfDateTime(row.created_at as string | undefined),
        `${String(row.donor_name || "—").slice(0, 34)} → ${String(row.recipient_name || "—").slice(0, 34)}`,
        String((row as { source_label?: string }).source_label || row.source || "—").slice(0, 18),
        row.points != null ? String(row.points) : "—",
        tradeLogHumanizeStatus(row.status).slice(0, 16),
      ]),
    )
  }

  addSectionHeader(pdf, "Point requests (workflow)", TRADE_CENTER_ACCENT)
  if (pointRequests.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No point requests on file.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else {
    addTradeCenterDataTable(
      pdf,
      ["When", "Requester ← Peer", "Source", "Pts", "Status"],
      [34, 88, 28, 14, 16],
      pointRequests.map((row) => [
        formatPdfDateTime(row.created_at as string | undefined),
        `${String(row.requester_name || "—").slice(0, 34)} ← ${String(row.requestee_name || "—").slice(0, 34)}`,
        String((row as { source_label?: string }).source_label || row.source || "—").slice(0, 18),
        row.points != null ? String(row.points) : "—",
        tradeLogHumanizeStatus(row.status).slice(0, 16),
      ]),
    )
  }

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }
  return pdf
}

const ATTENDANCE_GB_ACCENT: [number, number, number] = [139, 92, 246]

/**
 * Instructor attendance gradebook: `student_grades.attendance_score` snapshot for export/archive.
 */
export function exportAttendanceGradebookToPDF(
  rows: AttendanceGradebookExportRow[],
  options: PDFExportOptions & { showSectionColumn: boolean },
): jsPDF {
  const pdf = createPDFDocument({
    ...options,
    primaryColor: options.primaryColor || ATTENDANCE_GB_ACCENT,
  })
  const margin = (pdf as any).__margin || 15
  const contentWidth = (pdf as any).__contentWidth || 180
  let yPos = (pdf as any).__yPos ?? 50
  const pageHeight = (pdf as any).__pageHeight || 297
  const scopeLabel = options.sectionScopeLabel?.trim() || "All sections"

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  const intro = sanitizePdfPlainText(
    `Scope: ${scopeLabel}. Values come from student_grades.attendance_score (manual gradebook / imports). Rows: ${rows.length}.`,
  )
  const introLines = pdfSplitLines(pdf, intro, contentWidth)
  for (const line of introLines) {
    if (yPos + 5 > pageHeight - 20) {
      pdf.addPage()
      yPos = 50
    }
    pdf.text(line, margin, yPos)
    yPos += 4.9
  }
  yPos += 4
  ;(pdf as any).__yPos = yPos

  addSectionHeader(pdf, "Gradebook attendance %", ATTENDANCE_GB_ACCENT)
  if (rows.length === 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("No gradebook attendance rows for this export.", margin, (pdf as any).__yPos)
    ;(pdf as any).__yPos += 8
  } else if (options.showSectionColumn) {
    addTradeCenterDataTable(
      pdf,
      ["Student", "ID", "Section", "Grade row", "Att %", "Updated"],
      [42, 26, 28, 38, 22, 24],
      rows.map((r) => [
        r.studentName.slice(0, 28),
        r.studentNumber.slice(0, 12),
        r.section.slice(0, 14),
        r.gradeSession.slice(0, 22),
        `${r.attendanceScore}`,
        formatPdfDateTime(r.lastCalculatedAt ?? undefined),
      ]),
    )
  } else {
    addTradeCenterDataTable(
      pdf,
      ["Student", "ID", "Grade row", "Att %", "Updated"],
      [52, 28, 46, 22, 32],
      rows.map((r) => [
        r.studentName.slice(0, 36),
        r.studentNumber.slice(0, 14),
        r.gradeSession.slice(0, 28),
        `${r.attendanceScore}`,
        formatPdfDateTime(r.lastCalculatedAt ?? undefined),
      ]),
    )
  }

  if (options.includePageNumbers !== false) {
    addPageNumbers(pdf)
  }
  return pdf
}

