/** Instructor dashboard v2 route to preview a lecture (slides/PDF) without a student session. */
export function instructorLecturePreviewPath(lectureId: number): string {
  return `/instructor/dashboard-v2/content/lectures/${lectureId}`
}
