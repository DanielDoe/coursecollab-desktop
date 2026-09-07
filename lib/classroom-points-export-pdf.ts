/**
 * Single-student portfolio PDF: all classroom point awards (especially code submissions)
 * in one document for instructor exports.
 */
import { jsPDF } from "jspdf"
import { classroomRawPointsToGradePoints10 } from "@/lib/classroom-points-grade-scale"
import { sanitizeFilenameSegment } from "@/lib/results-pdf-filename"
import { pdfSplitLines, sanitizePdfPlainText } from "@/lib/pdf-text-sanitize"

export type ClassroomPointExportRow = {
  id: number
  student_id: number
  student_name: string
  student_number: string
  student_section: string
  points: number
  reason: string
  category: string
  status?: string | null
  awarded_at?: string | null
  created_at?: string | null
  submission_id?: number | null
  submission_title?: string | null
  code?: string | null
  plot_image?: string | null
}

export function sanitizeStudentPortfolioPdfFilename(fullName: string, studentNumber: string): string {
  const n = sanitizeFilenameSegment(fullName) || "student"
  const id = sanitizeFilenameSegment(String(studentNumber)) || "id"
  return `${n}-${id}.pdf`
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    code_submission: "Code assignment",
    solution_submission: "Solution assignment",
    presentation: "Presentation",
    participation: "Class participation",
    quiz_bonus: "Quiz bonus",
    extra_credit: "Extra credit",
    other: "Other",
  }
  return map[cat] ?? cat.replace(/_/g, " ")
}

function compactAwardHeadingTitle(raw: string, fallback: string): string {
  const t = sanitizePdfPlainText(raw.replace(/\r\n/g, "\n").replace(/\n+/g, " "))
  return t.length > 0 ? t : fallback
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return String(iso)
  }
}

const PAGE_W = 210
const PAGE_H = 297
const M = 14

function addWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeightMm: number,
): number {
  const lines = pdfSplitLines(doc, text, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeightMm
}

function tryAddPlot(
  doc: jsPDF,
  plot: string | null | undefined,
  x: number,
  y: number,
  maxWidthMm: number,
): number {
  if (!plot || !String(plot).trim()) return y

  let imageData = String(plot).trim()
  let format: "PNG" | "JPEG" = "PNG"

  const dataUrl = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
  if (dataUrl) {
    format = dataUrl[1].toLowerCase().startsWith("j") ? "JPEG" : "PNG"
    imageData = plot
  } else {
    // Assume raw base64 PNG
    imageData = `data:image/png;base64,${imageData}`
  }

  try {
    const props = doc.getImageProperties(imageData)
    if (!props?.width || !props?.height) return y
    const wMm = maxWidthMm
    const hMm = (props.height * wMm) / props.width
    const maxH = 120
    const scale = hMm > maxH ? maxH / hMm : 1
    const fw = wMm * scale
    const fh = hMm * scale
    doc.addImage(imageData, format, x, y, fw, fh)
    return y + fh + 6
  } catch {
    return addWrapped(doc, "[Plot image could not be embedded]", x, y, maxWidthMm, 5)
  }
}

export function buildClassroomPointsPortfolioPdfBuffer(rows: ClassroomPointExportRow[]): ArrayBuffer {
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.awarded_at || a.created_at || 0).getTime()
    const tb = new Date(b.awarded_at || b.created_at || 0).getTime()
    return ta - tb
  })

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const contentW = PAGE_W - 2 * M
  let y = M

  const first = sorted[0]
  const totalRaw = sorted.reduce((s, r) => s + Number(r.points || 0), 0)
  const grade10 = classroomRawPointsToGradePoints10(totalRaw)

  doc.setFillColor(245, 243, 255)
  doc.rect(0, 0, PAGE_W, 42, "F")
  doc.setTextColor(55, 48, 163)
  doc.setFontSize(18)
  doc.text("Classroom points portfolio", M, y + 8)
  doc.setTextColor(60, 60, 60)
  doc.setFontSize(11)
  y = 22
  doc.text(`Student: ${sanitizePdfPlainText(first.student_name)}`, M, y)
  y += 6
  doc.text(`Student ID: ${sanitizePdfPlainText(first.student_number)}`, M, y)
  y += 6
  doc.text(`Section: ${sanitizePdfPlainText(first.student_section || "—")}`, M, y)
  y += 6
  doc.text(
    `Totals: ${totalRaw.toFixed(2)} raw pts → ${grade10.toFixed(2)} / 10 (course scale) · ${sorted.length} award(s)`,
    M,
    y,
  )

  y = 48
  doc.setDrawColor(200, 200, 210)
  doc.line(M, y, PAGE_W - M, y)
  y += 10

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > PAGE_H - M) {
      doc.addPage()
      y = M
    }
  }

  sorted.forEach((row, idx) => {
    const rawTitle =
      (row.submission_title && row.submission_title.trim()) ||
      (row.reason?.split("\n")[0]?.slice(0, 120) ?? `Award #${row.id}`)
    const title = compactAwardHeadingTitle(rawTitle, `Award #${row.id}`)
    const heading = `${idx + 1}. ${title}`
    ensureSpace(28)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    y = addWrapped(doc, heading, M, y, contentW, 5) + 2

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(80, 80, 90)
    const meta = `${categoryLabel(row.category)} · ${Number(row.points || 0).toFixed(2)} pts · ${fmtWhen(row.awarded_at || row.created_at)}`
    y = addWrapped(doc, meta, M, y, contentW, 4.2) + 4

    doc.setTextColor(45, 45, 55)
    doc.setFontSize(10)
    const reason =
      sanitizePdfPlainText((row.reason || "").trim()) ||
      "—"
    ensureSpace(40)
    y = addWrapped(doc, reason, M, y, contentW, 4.8) + 6

    const code = (row.code || "").trim()
    if (code) {
      doc.setFont("courier", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(25, 65, 95)
      const codeLines = pdfSplitLines(doc, code, contentW - 4)
      const lineH = 4.2
      const blockH = codeLines.length * lineH + 8
      ensureSpace(blockH + 10)
      doc.setDrawColor(210, 220, 235)
      doc.roundedRect(M - 1, y - 4, contentW + 2, blockH, 1, 1, "S")
      doc.text(codeLines, M + 2, y)
      y += codeLines.length * lineH + 10
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(45, 45, 55)
    }

    if (row.plot_image?.trim()) {
      ensureSpace(40)
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 100)
      y = addWrapped(doc, "Submitted plot:", M, y, contentW, 4.5) + 2
      ensureSpace(125)
      y = tryAddPlot(doc, row.plot_image, M, y, contentW)
    }

    y += 8
    doc.setDrawColor(235, 235, 240)
    doc.line(M, y - 4, PAGE_W - M, y - 4)
  })

  doc.setFontSize(8)
  doc.setTextColor(140, 140, 150)
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.text(`Page ${i} / ${pageCount}`, PAGE_W - M - 22, PAGE_H - 8)
  }

  return doc.output("arraybuffer") as ArrayBuffer
}
