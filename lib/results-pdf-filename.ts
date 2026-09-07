/**
 * Browser-safe filename segments for assessment results PDFs.
 * Pattern: {studentName}-{section}-{assessmentType}[{-suffix}].pdf
 */

export function sanitizeFilenameSegment(input: string | null | undefined): string {
  if (input == null || typeof input !== "string") return ""
  return input
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function assessmentTypeToSlug(assessmentType: string | undefined): string {
  const t = (assessmentType ?? "quiz").toLowerCase().trim()
  const map: Record<string, string> = {
    mid_semester: "mid-semester",
    "mid-semester": "mid-semester",
    midsem: "mid-semester",
    final: "final",
    finals: "finals",
    homework: "homework",
    quiz: "quiz",
    practice: "practice",
    points: "points",
  }
  return map[t] ?? t.replace(/_/g, "-")
}

export function buildResultsPdfFilename(
  studentName: string | null | undefined,
  section: string | null | undefined,
  assessmentType: string | undefined,
  suffix?: string,
): string {
  const name = sanitizeFilenameSegment(studentName) || "student"
  const sess = sanitizeFilenameSegment(section) || "no-section"
  const typeSlug = sanitizeFilenameSegment(assessmentTypeToSlug(assessmentType)) || "quiz"
  const base = `${name}-${sess}-${typeSlug}`
  if (suffix) {
    const s = sanitizeFilenameSegment(suffix)
    return s ? `${base}-${s}.pdf` : `${base}.pdf`
  }
  return `${base}.pdf`
}

/** Zip/CSV download: `{session}-{assessment-title}` (filesystem-safe). */
export function buildSessionAssessmentExportBasename(
  sessionLabel: string | null | undefined,
  assessmentTitle: string | null | undefined,
): string {
  const s = sanitizeFilenameSegment(sessionLabel) || "session"
  const t = sanitizeFilenameSegment(assessmentTitle) || "assessment"
  return `${s}-${t}`
}
