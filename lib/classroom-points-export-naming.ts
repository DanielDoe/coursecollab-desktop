import { sanitizeFilenameSegment } from "@/lib/results-pdf-filename"

/** Calendar semester label for archive names (US-style: Jul–Dec → fall). */
export function classroomPointsExportSemesterYearLabel(d = new Date()): string {
  const year = d.getFullYear()
  const month = d.getMonth()
  const semester = month >= 6 ? "fall" : "spring"
  return `${semester}-${year}`
}

/**
 * ZIP basename: `{section}-classroom-points-{semester}-{year}`
 * e.g. `ELEG1304P01-classroom-points-spring-2026`
 */
export function classroomPointsZipBasename(sectionFilterValue: string, d = new Date()): string {
  const sectionPart =
    sectionFilterValue === "all"
      ? "all-sections"
      : sanitizeFilenameSegment(sectionFilterValue) || "section"
  const sy = classroomPointsExportSemesterYearLabel(d)
  return `${sectionPart}-classroom-points-${sy}`
}
