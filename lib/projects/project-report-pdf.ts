import { jsPDF } from "jspdf"
import { formatRichTextForPdf } from "@/lib/pdf-rich-text"
import { parseProjectEvaluation } from "@/lib/projects/project-evaluation-text"
import { pdfSplitLines, sanitizePdfPlainText } from "@/lib/pdf-text-sanitize"
import { blockHasContent, blockPlain, creditsForBlock, summarizeContributions, type ContributionRow } from "@/lib/projects/project-contribution"
import type { ProjectResponseField, ProjectTemplateSectionConfig, SectionContentBlock } from "@/lib/projects/project-template-types"
import { collectFiguresFromSections, figureHeading, figureLine, figureSourceLine, figuresForBlock } from "@/lib/projects/project-report-figures"

export type ProjectReportPdfSection = {
  id: number
  title: string
  instructions?: string | null
  config?: ProjectTemplateSectionConfig
  current_revision?: {
    content?: { blocks?: SectionContentBlock[]; field_meta?: Record<string, { author_name?: string; author_student_id?: number; contributors?: { student_id?: number; name: string; words: number }[] }> }
    created_by_student_id?: number | null
    author_name?: string | null
  } | null
}

export type ProjectReportPdfInput = {
  title: string
  groupName: string
  session: string
  members: Array<{ id?: number; full_name?: string; student_id?: string }>
  statusLabel: string
  finalized: boolean
  integrityCount: number
  totals: { earned: number; cap: number; pct: number; graded: number; possible: number }
  contributions: ContributionRow[]
  sections: ProjectReportPdfSection[]
  grades: Array<{ workspace_section_id: number | null; score: number; feedback?: string | null }>
  feedbackBySection: Record<number, string>
}

const PURPLE: [number, number, number] = [88, 44, 131]
const GOLD: [number, number, number] = [234, 170, 0]
const INK: [number, number, number] = [30, 41, 59]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]
const PAPER: [number, number, number] = [248, 250, 252]
const SOFT: [number, number, number] = [239, 232, 246]

/** Turn stored rich text into prose. Image tags are dropped; figures are cited separately. */
export function htmlToReportText(value: string) {
  let s = String(value ?? "")
  s = s.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "\n")
  s = s.replace(/<img\b[^>]*\/?>/gi, "")
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|ul|ol)>/gi, "\n\n")
  s = s.replace(/<li\b[^>]*>/gi, "\n- ")
  s = s.replace(/<\/?[a-z][^>]*>/gi, "")
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

function plain(value: string) {
  return sanitizePdfPlainText(formatRichTextForPdf(htmlToReportText(value)))
}

function reportParagraphs(value: string) {
  const cleaned = formatRichTextForPdf(htmlToReportText(value))
  return cleaned
    .split(/\n{2,}/)
    .map((paragraph) => sanitizePdfPlainText(paragraph.replace(/\n/g, " ")))
    .filter(Boolean)
}

export { parseProjectEvaluation } from "@/lib/projects/project-evaluation-text"

function drawScoreRing(pdf: jsPDF, cx: number, cy: number, radius: number, pct: number) {
  pdf.setLineCap("round")
  pdf.setLineWidth(2.4)
  pdf.setDrawColor(...LINE)
  pdf.circle(cx, cy, radius, "S")
  const sweepPct = Math.max(0, Math.min(100, pct))
  if (sweepPct <= 0) return
  const steps = Math.max(8, Math.round((sweepPct / 100) * 56))
  const start = -Math.PI / 2
  const sweep = (sweepPct / 100) * Math.PI * 2
  pdf.setDrawColor(...GOLD)
  pdf.setLineWidth(2.6)
  let prevX = cx + radius * Math.cos(start)
  let prevY = cy + radius * Math.sin(start)
  for (let i = 1; i <= steps; i += 1) {
    const angle = start + sweep * (i / steps)
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    pdf.line(prevX, prevY, x, y)
    prevX = x
    prevY = y
  }
}

function blockBody(block: SectionContentBlock): { text: string; mono: boolean } {
  switch (block.type) {
    case "code":
      return { text: block.code.trim(), mono: true }
    case "equation":
      return { text: plain(block.latex), mono: true }
    case "table": {
      const header = block.headers.filter(Boolean).join(" | ")
      const rows = block.rows.map((row) => row.join(" | ")).join("\n")
      return { text: [header, rows].filter(Boolean).join("\n"), mono: false }
    }
    case "link":
      return { text: plain(`${block.label || "Link"}: ${block.url}`), mono: false }
    case "image":
    case "figure":
      return { text: "", mono: false }
    case "file":
      return { text: plain(block.label ? `File: ${block.label}` : "File attached"), mono: false }
    case "diagram":
      return { text: "", mono: false }
    default:
      return { text: "html" in block && block.html ? block.html : blockPlain(block), mono: false }
  }
}

async function imageDataUrl(url: string): Promise<string | null> {
  if (!url || url.startsWith("data:image/")) return url.startsWith("data:image/") ? url : null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const type = blob.type || (res.headers.get("content-type") || "").split(";")[0]
    if (!type.startsWith("image/")) return null
    const mime = type.split(";")[0]
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const bufferApi = (globalThis as { Buffer?: { from(data: Uint8Array): { toString(encoding: string): string } } }).Buffer
    if (bufferApi) return `data:${mime};base64,${bufferApi.from(bytes).toString("base64")}`
    let binary = ""
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return `data:${mime};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

export async function buildProjectReportPdf(input: ProjectReportPdfInput) {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 14
  const width = pageW - margin * 2
  let y = 0

  const newPage = () => {
    pdf.addPage()
    y = 16
  }

  const need = (height: number) => {
    if (y + height > pageH - 14) newPage()
  }

  const textLines = (value: string, maxWidth: number, size: number) => {
    pdf.setFontSize(size)
    return pdfSplitLines(pdf, plain(value) || " ", maxWidth)
  }

  const writeLines = (
    lines: string[],
    x: number,
    size: number,
    style: "normal" | "bold" = "normal",
    color: [number, number, number] = INK,
    font: "helvetica" | "courier" = "helvetica",
  ) => {
    pdf.setFont(font, style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const step = size * 0.42 + 1.1
    for (const line of lines) {
      need(step + 1)
      pdf.text(line, x, y)
      y += step
    }
  }

  pdf.setFillColor(...PURPLE)
  pdf.rect(0, 0, pageW, 32, "F")
  pdf.setFillColor(...GOLD)
  pdf.rect(0, 32, pageW, 1.4, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(9)
  pdf.text("COURSECOLLAB", margin, 10)
  pdf.setFontSize(18)
  pdf.text("Project report", margin, 19)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(11)
  const titleLines = textLines(input.title || "Project", width, 11)
  pdf.text(titleLines[0] || "Project", margin, 27)
  y = 40

  const memberLine =
    input.members
      .map((member) => {
        const name = member.full_name || "Member"
        return member.student_id ? `${name} (${member.student_id})` : name
      })
      .join("  ·  ") || "No members"
  const memberLines = textLines(memberLine, width - 8, 10)
  const groupHeight = 18 + memberLines.length * 5
  pdf.setFillColor(...PAPER)
  pdf.roundedRect(margin, y, width, groupHeight, 2, 2, "F")
  pdf.setTextColor(...MUTED)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("GROUP", margin + 4, y + 6)
  pdf.text("SESSION", margin + width * 0.48, y + 6)
  pdf.setTextColor(...INK)
  pdf.setFontSize(11)
  pdf.text(plain(input.groupName || "Project group").slice(0, 42), margin + 4, y + 12)
  pdf.text(plain(input.session || "Section").slice(0, 28), margin + width * 0.48, y + 12)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  pdf.setTextColor(...MUTED)
  let memberY = y + 18
  for (const line of memberLines) {
    pdf.text(line, margin + 4, memberY)
    memberY += 5
  }
  y += groupHeight + 6

  const scoreH = 42
  pdf.setFillColor(...PAPER)
  pdf.roundedRect(margin, y, width, scoreH, 2, 2, "F")
  const ringX = margin + 22
  const ringY = y + scoreH / 2
  drawScoreRing(pdf, ringX, ringY, 12, input.totals.pct)
  pdf.setTextColor(...PURPLE)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text(`${input.totals.pct}%`, ringX, ringY + 1.4, { align: "center" })

  const scoreX = margin + 42
  pdf.setTextColor(...INK)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.text(`${input.totals.earned.toFixed(1)} / ${input.totals.cap} pts`, scoreX, y + 16)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  const status = input.finalized ? "Final grade" : "Provisional — waiting for instructor approval"
  pdf.text(plain(status), scoreX, y + 22)
  const barW = width - 50
  pdf.setFillColor(...LINE)
  pdf.roundedRect(scoreX, y + 28, barW, 2.4, 1, 1, "F")
  pdf.setFillColor(...GOLD)
  pdf.roundedRect(scoreX, y + 28, Math.max(1.6, barW * (Math.min(100, input.totals.pct) / 100)), 2.4, 1, 1, "F")
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text(
    plain(`${input.totals.graded} of ${input.sections.length} sections graded`),
    scoreX,
    y + 36,
  )
  if (input.integrityCount > 0) {
    pdf.setTextColor(146, 64, 14)
    pdf.text(
      `${input.integrityCount} behavioral flag${input.integrityCount === 1 ? "" : "s"} logged`,
      scoreX + 52,
      y + 36,
    )
  }
  y += scoreH + 8

  need(16)
  pdf.setTextColor(...INK)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(12)
  pdf.text("Who wrote what", margin, y)
  y += 5
  pdf.setDrawColor(...LINE)
  pdf.setLineWidth(0.2)
  pdf.line(margin, y, margin + width, y)
  y += 5
  if (input.contributions.length === 0) {
    writeLines(["No group members on this project."], margin, 10, "normal", MUTED)
  } else {
    for (const row of input.contributions) {
      const detail =
        row.words > 0
          ? `${row.words} words  ·  ${row.sections} section${row.sections === 1 ? "" : "s"}  ·  ${row.pct}%`
          : row.sections > 0
            ? `${row.items} fields  ·  ${row.sections} section${row.sections === 1 ? "" : "s"}`
            : "No saved writing yet"
      need(8)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.setTextColor(...INK)
      pdf.text(plain(row.name), margin, y)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(...MUTED)
      pdf.text(detail, margin + width, y, { align: "right" })
      y += 4
      pdf.setFillColor(...LINE)
      pdf.roundedRect(margin, y, width, 1.4, 0.4, 0.4, "F")
      pdf.setFillColor(...PURPLE)
      pdf.roundedRect(margin, y, Math.max(0, width * (row.pct / 100)), 1.4, 0.4, 0.4, "F")
      y += 5
    }
  }
  y += 3

  need(18)
  pdf.setTextColor(...INK)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(12)
  pdf.text("Section scores", margin, y)
  y += 5
  pdf.setFillColor(...PURPLE)
  pdf.rect(margin, y, width, 7, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.text("SECTION", margin + 2, y + 4.6)
  pdf.text("SCORE", margin + width - 48, y + 4.6)
  pdf.text("WEIGHT", margin + width - 28, y + 4.6)
  pdf.text("TOTAL", margin + width - 12, y + 4.6)
  y += 7

  input.sections.forEach((section, index) => {
    const max = Number(section.config?.points) || 0
    const entry = input.grades.find((grade) => grade.workspace_section_id === section.id)
    const earned = entry ? Number(entry.score) : null
    const weight = input.totals.possible > 0 ? Math.round((max / input.totals.possible) * 1000) / 10 : 0
    const toward = earned != null && max > 0 ? ((earned / max) * weight).toFixed(1) : "0"
    need(7)
    if (index % 2 === 0) {
      pdf.setFillColor(...PAPER)
      pdf.rect(margin, y, width, 6.5, "F")
    }
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(...INK)
    const label = plain(`${index + 1}. ${section.title}`)
    pdf.text(label.length > 62 ? `${label.slice(0, 60)}…` : label, margin + 2, y + 4.4)
    pdf.text(earned == null ? "—" : `${earned.toFixed(1)} / ${max}`, margin + width - 48, y + 4.4)
    pdf.text(`${weight}%`, margin + width - 28, y + 4.4)
    pdf.text(`+${toward}`, margin + width - 12, y + 4.4)
    y += 6.5
  })
  y += 8

  const catalog = collectFiguresFromSections(
    input.sections.map((section) => ({
      title: section.title,
      config: section.config,
      blocks: section.current_revision?.content?.blocks ?? [],
    })),
  )

  for (const [index, section] of input.sections.entries()) {
    const max = Number(section.config?.points) || 0
    const entry = input.grades.find((grade) => grade.workspace_section_id === section.id)
    const earned = entry ? Number(entry.score) : null
    const feedback = (input.feedbackBySection[section.id] || entry?.feedback || "").trim()
    const fields = (section.config?.response_fields ?? []) as ProjectResponseField[]
    const blocks = section.current_revision?.content?.blocks ?? []
    const rows =
      fields.length > 0
        ? fields.map((field) => ({
            label: field.label,
            fieldId: field.id,
            block: blocks.find((block) => block.id === field.id),
          }))
        : blocks
            .filter((block) => blockHasContent(block))
            .map((block) => ({ label: "", fieldId: block.id, block }))

    need(22)
    pdf.setFillColor(...PURPLE)
    pdf.rect(margin, y, width, 10, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    const heading = plain(`${index + 1}. ${section.title}`)
    pdf.text(heading.length > 70 ? `${heading.slice(0, 68)}…` : heading, margin + 3, y + 6.5)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.text(earned == null ? `of ${max}` : `${earned.toFixed(1)} / ${max}`, margin + width - 3, y + 6.5, { align: "right" })
    y += 14

    const authors = [
      ...new Set(
        blocks.flatMap((block) => creditsForBlock(section, block).map((credit) => credit.name)).filter(Boolean),
      ),
    ]
    if (authors.length) {
      writeLines([`Written by ${authors.join(", ")}`], margin, 9, "normal", MUTED)
      y += 1
    }
    if (section.instructions?.trim()) {
      writeLines(["Prompt"], margin, 8, "bold", MUTED)
      writeLines(textLines(section.instructions, width, 9), margin, 9, "normal", MUTED)
      y += 1
    }

    if (rows.length === 0) {
      writeLines(["No submission yet."], margin, 10, "normal", MUTED)
    }

    for (const row of rows) {
      const filled = row.block ? blockHasContent(row.block) : false
      const names = row.block ? creditsForBlock(section, row.block).map((credit) => credit.name) : []
      if (row.label) {
        need(8)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(8)
        pdf.setTextColor(...PURPLE)
        pdf.text(plain(row.label).toUpperCase(), margin, y)
        y += 4
      }
      if (names.length) {
        writeLines([names.join("  ·  ")], margin, 8, "normal", MUTED)
      }
      if (!filled || !row.block) {
        const roster =
          row.fieldId === "cover-members"
            ? input.members.map((member) => member.full_name).filter(Boolean).join(", ")
            : ""
        writeLines([roster || "Not answered."], margin, 10, "normal", roster ? INK : MUTED)
        if (roster) writeLines(["From the project group"], margin, 8, "normal", MUTED)
        y += 2
        continue
      }
      const attached = figuresForBlock(catalog, row.fieldId)
      if (attached.length) {
        for (const figure of attached) writeLines([figureLine(figure)], margin, 10, "normal", INK)
      }
      const pictureOnly =
        attached.length > 0 &&
        (row.block.type === "image" || row.block.type === "figure" || row.block.type === "diagram")
      const body = pictureOnly ? { text: "", mono: false } : blockBody(row.block)
      if (body.text) {
        const captions = new Set(attached.map((figure) => figure.caption.trim().toLowerCase()))
        if (body.mono) {
          const lines = body.text.split("\n").flatMap((line) => pdfSplitLines(pdf, plain(line) || " ", width))
          writeLines(lines.slice(0, 400), margin, 8, "normal", INK, "courier")
          if (lines.length > 400) writeLines(["Further lines omitted."], margin, 8, "normal", MUTED)
        } else {
          const paragraphs = reportParagraphs(body.text)
            .filter((paragraph) => !captions.has(paragraph.trim().toLowerCase()))
            .slice(0, 40)
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(10)
          for (const paragraph of paragraphs) {
            writeLines(pdfSplitLines(pdf, paragraph, width), margin, 10, "normal", INK)
            y += 1.2
          }
        }
      }
      y += 2
    }

    const pageBeforeEvaluation = pdf.getNumberOfPages()
    const parsed = feedback ? parseProjectEvaluation(feedback) : null
    const scoreLabel =
      parsed?.score || (earned == null ? "Not scored" : `${earned.toFixed(1)} / ${max}`)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    const rubricRows = (parsed?.rubric ?? []).map((item) => ({
      title: pdfSplitLines(pdf, plain(item.level ? `${item.title} — ${item.level}` : item.title), width - 16),
      note: item.note ? pdfSplitLines(pdf, plain(item.note), width - 16) : [],
    }))
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    const wrapList = (items: string[]) => items.flatMap((item) => pdfSplitLines(pdf, plain(item), width - 18))
    const groups = [
      parsed?.reason ? { label: "WHY THIS SCORE", lines: pdfSplitLines(pdf, plain(parsed.reason), width - 16) } : null,
      parsed?.didWell.length ? { label: "WHAT YOU DID WELL", lines: wrapList(parsed.didWell) } : null,
      parsed?.missing.length ? { label: "WHAT'S MISSING", lines: wrapList(parsed.missing) } : null,
      parsed?.improve.length ? { label: "HOW TO IMPROVE", lines: wrapList(parsed.improve) } : null,
    ].filter((group): group is { label: string; lines: string[] } => Boolean(group && group.lines.length))
    const lineH = 4.3
    const innerH =
      16 +
      (rubricRows.length ? 6 : 0) +
      rubricRows.reduce((sum, row) => sum + (row.title.length + row.note.length) * lineH + 2, 0) +
      groups.reduce((sum, group) => sum + 8 + group.lines.length * lineH, 0) +
      (rubricRows.length === 0 && groups.length === 0 ? 10 : 8)
    if (y + innerH > pageH - 16 && y > 48) newPage()
    const cardTop = y
    const fits = y + innerH <= pageH - 16
    if (fits) {
      pdf.setFillColor(...SOFT)
      pdf.roundedRect(margin, y, width, innerH, 2, 2, "F")
      pdf.setFillColor(...PURPLE)
      pdf.rect(margin, y + 2, 2.2, innerH - 4, "F")
    }
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.setTextColor(...PURPLE)
    pdf.text("EVALUATION", margin + 8, y + 6)
    pdf.setFontSize(11)
    pdf.setTextColor(...INK)
    pdf.text(plain(scoreLabel), margin + width - 6, y + 6.4, { align: "right" })
    y += 12
    const paintRule = () => {
      pdf.setDrawColor(...LINE)
      pdf.setLineWidth(0.2)
      pdf.line(margin + 8, y, margin + width - 6, y)
      y += 4
    }
    if (rubricRows.length) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      pdf.setTextColor(...MUTED)
      pdf.text("RUBRIC", margin + 8, y)
      y += 4
      paintRule()
      for (const row of rubricRows) {
        for (const line of row.title) {
          need(lineH)
          pdf.setFont("helvetica", "bold")
          pdf.setFontSize(9)
          pdf.setTextColor(...INK)
          pdf.text(line, margin + 8, y)
          y += lineH
        }
        for (const line of row.note) {
          need(lineH)
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(9)
          pdf.setTextColor(51, 65, 85)
          pdf.text(line, margin + 8, y)
          y += lineH
        }
        y += 1.6
      }
    }
    for (const group of groups) {
      need(8)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      pdf.setTextColor(...MUTED)
      pdf.text(group.label, margin + 8, y)
      y += 4
      paintRule()
      for (const line of group.lines) {
        need(lineH)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        pdf.setTextColor(...INK)
        pdf.text(line, margin + 8, y)
        y += lineH
      }
      y += 1
    }
    if (!rubricRows.length && !groups.length) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.setTextColor(...MUTED)
      pdf.text(feedback ? plain(feedback).slice(0, 280) : "No evaluation feedback yet.", margin + 8, y)
      y += 6
    }
    const stayedOnCardPage = pdf.getNumberOfPages() === pageBeforeEvaluation
    y = (fits && stayedOnCardPage ? Math.max(y, cardTop + innerH) : y) + 8
  }

  if (catalog.length) {
    newPage()
    pdf.setFillColor(...PURPLE)
    pdf.rect(margin, y, width, 10, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    pdf.text("Appendix A — Figures", margin + 3, y + 6.5)
    y += 14
    writeLines(
      ["The report body cites each figure. The images themselves are collected here at a consistent size."],
      margin,
      9,
      "normal",
      MUTED,
    )
    y += 2
    for (const figure of catalog) {
      const data = await imageDataUrl(figure.src)
      let drawW = 0
      let drawH = 0
      let format: "PNG" | "JPEG" = "JPEG"
      if (data) {
        try {
          const props = pdf.getImageProperties(data)
          const maxH = 58
          const maxW = Math.min(width - 12, 132)
          drawW = maxW
          drawH = (props.height / props.width) * drawW
          if (drawH > maxH) {
            drawH = maxH
            drawW = (props.width / props.height) * drawH
          }
          format = data.includes("image/png") ? "PNG" : "JPEG"
        } catch {
          drawW = 0
        }
      }
      const blockH = 16 + (drawH || 8)
      need(blockH + 4)
      pdf.setFillColor(...PAPER)
      pdf.roundedRect(margin, y, width, blockH, 1.5, 1.5, "F")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.setTextColor(...PURPLE)
      pdf.text(plain(figureHeading(figure)).slice(0, 90), margin + 4, y + 6)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(...MUTED)
      pdf.text(plain(figureSourceLine(figure)).slice(0, 100), margin + 4, y + 11)
      if (data && drawW > 0) {
        const imageX = margin + (width - drawW) / 2
        const payload = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data
        pdf.addImage(payload, format, imageX, y + 14, drawW, drawH, undefined, "FAST")
      } else {
        pdf.setFontSize(9)
        pdf.text("Figure file was unavailable.", margin + 4, y + 16)
      }
      y += blockH + 5
    }
  }

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text("CourseCollab project report", margin, pageH - 7)
    pdf.text(`${page} / ${pages}`, pageW - margin, pageH - 7, { align: "right" })
  }

  return pdf
}

export function gradingWorkspaceToReportInput(data: {
  project?: { title?: string; group_name?: string; session?: string } | null
  workspace?: {
    sections?: ProjectReportPdfSection[]
    members?: ProjectReportPdfInput["members"]
    workspace?: { submission_status?: string | null }
  } | null
  instructorGrades?: ProjectReportPdfInput["grades"]
  assignment?: { max_points?: number } | null
  integrityCount?: number
}): ProjectReportPdfInput {
  const sections = data.workspace?.sections ?? []
  const grades = data.instructorGrades ?? []
  const members = data.workspace?.members ?? []
  let earned = 0
  let possible = 0
  let graded = 0
  for (const section of sections) {
    const max = Number(section.config?.points) || 0
    possible += max
    const entry = grades.find((grade) => grade.workspace_section_id === section.id)
    if (entry) {
      earned += Number(entry.score) || 0
      graded += 1
    }
  }
  const cap = Number(data.assignment?.max_points) || possible || 20
  const status = data.workspace?.workspace?.submission_status
  const feedbackBySection: Record<number, string> = {}
  for (const grade of grades) {
    if (grade.workspace_section_id != null && grade.feedback) feedbackBySection[grade.workspace_section_id] = grade.feedback
  }
  return {
    title: String(data.project?.title || "Project report"),
    groupName: String(data.project?.group_name || ""),
    session: String(data.project?.session || ""),
    members,
    statusLabel: status ? String(status).replace(/_/g, " ") : "Draft",
    finalized: status === "FINALIZED",
    integrityCount: Number(data.integrityCount) || 0,
    totals: { earned, cap, pct: cap > 0 ? Math.round((earned / cap) * 100) : 0, graded, possible: possible || cap },
    contributions: summarizeContributions(sections, members),
    sections,
    grades,
    feedbackBySection,
  }
}

export async function saveProjectReportPdf(input: ProjectReportPdfInput) {
  const pdf = await buildProjectReportPdf(input)
  const slug = (input.groupName || input.title || "project-report").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
  pdf.save(`${slug || "project-report"}.pdf`)
}
