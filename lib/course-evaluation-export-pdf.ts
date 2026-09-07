import { jsPDF } from "jspdf"
import JSZip from "jszip"
import {
  INSTRUCTOR_CLARITY_LIKERT,
  LIKERT_5,
  PLATFORM_HELPFULNESS_LIKERT,
  likertLabel,
  SURVEY_OTHER_OPTION,
} from "@/lib/course-evaluation-survey"

export type CourseEvaluationExportProof = { url: string; file_name?: string; mime?: string }

export type CourseEvaluationExportRow = {
  full_name: string
  student_code: string
  section: string
  status: string
  course_rating?: number | null
  platform_helpfulness?: number | null
  favorite_features?: string[] | null
  favorite_features_other?: string | null
  feature_to_improve?: string | null
  feature_to_improve_other?: string | null
  improvement_suggestions?: string | null
  instructor_clarity?: number | null
  workload?: string | null
  ai_tutor_usage?: string | null
  nps_score?: number | null
  missing_features?: string | null
  self_assessed_letter_grade?: string | null
  actual_letter_grade?: string | null
  actual_total_score?: number | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Returned",
  draft: "Draft",
}

const MARGIN = 14
const PAGE_W = 210
const CONTENT_W = PAGE_W - MARGIN * 2

function sanitizePdfText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .trim()
}

function favoriteFeaturesLabel(row: CourseEvaluationExportRow): string {
  const favorites = Array.isArray(row.favorite_features) ? row.favorite_features : []
  if (favorites.length === 0) return "-"
  return favorites
    .map((f) =>
      f === SURVEY_OTHER_OPTION && row.favorite_features_other?.trim()
        ? `Other - ${row.favorite_features_other.trim()}`
        : f,
    )
    .join(", ")
}

function improveLabel(row: CourseEvaluationExportRow): string {
  if (!row.feature_to_improve) return "-"
  if (row.feature_to_improve === SURVEY_OTHER_OPTION && row.feature_to_improve_other?.trim()) {
    return `Other - ${row.feature_to_improve_other.trim()}`
  }
  return row.feature_to_improve
}

function buildSurveyLines(row: CourseEvaluationExportRow): Array<[string, string]> {
  const lines: Array<[string, string]> = [
    ["Overall course experience", likertLabel(LIKERT_5, row.course_rating)],
    ["CourseCollab improved learning", likertLabel(PLATFORM_HELPFULNESS_LIKERT, row.platform_helpfulness)],
    ["Favorite features", favoriteFeaturesLabel(row)],
    ["Improve first", improveLabel(row)],
    ["Open feedback", row.improvement_suggestions || "-"],
    ["Student pass goal", row.self_assessed_letter_grade || "-"],
    [
      "Current gradebook standing",
      row.actual_letter_grade
        ? `${row.actual_letter_grade}${row.actual_total_score != null ? ` (${Number(row.actual_total_score).toFixed(1)}%)` : ""}`
        : "-",
    ],
    ["Status", STATUS_LABELS[row.status] ?? row.status],
  ]
  if (row.instructor_clarity != null && row.instructor_clarity > 0) {
    lines.push(["Instructor explained clearly", likertLabel(INSTRUCTOR_CLARITY_LIKERT, row.instructor_clarity)])
  }
  if (row.workload) lines.push(["Workload", row.workload])
  if (row.ai_tutor_usage) lines.push(["AI Tutor usage", row.ai_tutor_usage])
  if (row.nps_score != null) lines.push(["Recommend score (NPS)", `${row.nps_score} / 10`])
  if (row.missing_features?.trim()) lines.push(["Missing features", row.missing_features.trim()])
  return lines
}

async function loadImageForPdf(
  url: string,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors" })
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const format: "PNG" | "JPEG" = dataUrl.includes("image/png") ? "PNG" : "JPEG"
    return { dataUrl, format }
  } catch {
    return null
  }
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageH = pdf.internal.pageSize.getHeight()
  if (y + needed > pageH - MARGIN) {
    pdf.addPage()
    return MARGIN
  }
  return y
}

function addSection(pdf: jsPDF, title: string, y: number): number {
  y = ensureSpace(pdf, y, 12)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text(sanitizePdfText(title), MARGIN, y)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  return y + 6
}

function addField(pdf: jsPDF, label: string, value: string, y: number): number {
  const body = sanitizePdfText(value || "-")
  const labelLine = sanitizePdfText(label)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(9)
  y = ensureSpace(pdf, y, 8)
  pdf.text(labelLine, MARGIN, y)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  const wrapped = pdf.splitTextToSize(body, CONTENT_W) as string[]
  y = ensureSpace(pdf, y + 4, wrapped.length * 4.5 + 2)
  pdf.text(wrapped, MARGIN, y + 4)
  return y + 4 + wrapped.length * 4.5 + 4
}

export function buildCourseEvaluationPdfFilename(row: CourseEvaluationExportRow): string {
  const code = sanitizePdfText(row.student_code || "student").replace(/\s+/g, "-")
  return `course-evaluation-${code}.pdf`
}

export async function buildCourseEvaluationPdfBlob(
  row: CourseEvaluationExportRow,
  proofs: CourseEvaluationExportProof[],
): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4")
  let y = MARGIN

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.text("Course Evaluation Report", MARGIN, y)
  y += 8

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(11)
  pdf.text(sanitizePdfText(row.full_name || "Student"), MARGIN, y)
  y += 5
  pdf.setFontSize(10)
  pdf.setTextColor(80, 80, 80)
  pdf.text(sanitizePdfText(`${row.student_code || ""} · ${row.section || ""}`), MARGIN, y)
  pdf.setTextColor(0, 0, 0)
  y += 10

  y = addSection(pdf, "Survey responses", y)
  for (const [label, value] of buildSurveyLines(row)) {
    y = addField(pdf, label, value, y)
  }

  if (proofs.length > 0) {
    y = addSection(pdf, "Canvas evaluation proof", y)
    for (const proof of proofs) {
      const caption = sanitizePdfText(proof.file_name || "Canvas proof")
      if (proof.mime?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(proof.url)) {
        const img = await loadImageForPdf(proof.url)
        if (img) {
          y = ensureSpace(pdf, y, 60)
          pdf.setFontSize(9)
          pdf.text(caption, MARGIN, y)
          y += 4
          const maxW = CONTENT_W
          const maxH = 100
          y = ensureSpace(pdf, y, maxH + 8)
          try {
            pdf.addImage(img.dataUrl, img.format, MARGIN, y, maxW, maxH, undefined, "FAST")
            y += maxH + 8
          } catch {
            y = addField(pdf, caption, `[Image could not be embedded — see: ${proof.url}]`, y)
          }
        } else {
          y = addField(pdf, caption, `[Image — open URL: ${proof.url}]`, y)
        }
      } else {
        y = addField(pdf, caption, `[Document — ${proof.url}]`, y)
      }
    }
  }

  return pdf.output("blob")
}

export async function downloadCourseEvaluationPdf(
  row: CourseEvaluationExportRow,
  proofs: CourseEvaluationExportProof[],
): Promise<void> {
  const blob = await buildCourseEvaluationPdfBlob(row, proofs)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = buildCourseEvaluationPdfFilename(row)
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadCourseEvaluationsZip(
  items: Array<{ row: CourseEvaluationExportRow; proofs: CourseEvaluationExportProof[] }>,
  zipName = "course-evaluations.zip",
): Promise<void> {
  const zip = new JSZip()
  for (const { row, proofs } of items) {
    const blob = await buildCourseEvaluationPdfBlob(row, proofs)
    zip.file(buildCourseEvaluationPdfFilename(row), blob)
  }
  const zipBlob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement("a")
  a.href = url
  a.download = zipName
  a.click()
  URL.revokeObjectURL(url)
}
