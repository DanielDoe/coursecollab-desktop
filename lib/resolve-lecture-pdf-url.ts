/** Absolute URL for a lecture PDF path or external link. */
export function resolveLecturePdfUrl(pdfUrl: string): string {
  if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) return pdfUrl
  if (typeof window === "undefined") return pdfUrl
  return `${window.location.origin}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`
}

/** Same-origin proxy URL for student/instructor slide viewing (avoids cross-origin iframe tainting). */
export function buildLecturePdfProxyUrl(
  lectureId: number,
  opts?: { studentId?: string | null; download?: boolean },
): string {
  const q = new URLSearchParams()
  if (opts?.studentId?.trim()) q.set("studentId", opts.studentId.trim())
  if (opts?.download) q.set("download", "1")
  const qs = q.toString()
  return `/api/pdf-proxy/${lectureId}${qs ? `?${qs}` : ""}`
}

export function lecturePdfDownloadName(title?: string): string {
  return title ? `${title.replace(/[^\w.-]+/g, "_")}.pdf` : "lecture.pdf"
}
