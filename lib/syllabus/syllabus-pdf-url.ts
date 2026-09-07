export function buildSyllabusPdfProxyUrl(
  courseId: number,
  opts?: { studentId?: string | null; download?: boolean },
): string {
  const q = new URLSearchParams()
  if (opts?.studentId?.trim()) q.set("studentId", opts.studentId.trim())
  if (opts?.download) q.set("download", "1")
  const qs = q.toString()
  return `/api/syllabus-pdf/${courseId}${qs ? `?${qs}` : ""}`
}

export function syllabusPdfDownloadName(title?: string): string {
  return title ? `${title.replace(/[^\w.-]+/g, "_")}.pdf` : "syllabus.pdf"
}
