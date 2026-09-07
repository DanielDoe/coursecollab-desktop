/** Student dashboard v2 lecture slide viewer (week route + lectureId query). */
export function buildStudentLectureViewerHref(lectureId: number, week: number): string {
  const w = Number(week)
  const id = Number(lectureId)
  if (!Number.isFinite(w) || !Number.isFinite(id)) {
    return "/student/dashboard-v2/lectures"
  }
  return `/student/dashboard-v2/lectures/${w}?lectureId=${id}`
}
