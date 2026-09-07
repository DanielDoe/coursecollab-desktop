/** Lecture list hub — progress/status filter parity with mobile LecturesScreen. */

export type LectureCardKind = "completed" | "in_progress" | "available" | "locked"

export type LectureFilter = "all" | LectureCardKind

export type LectureListItem = {
  status?: string | null
  progress_percentage?: number | null
}

export function clampLectureProgress(value?: number | null): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function resolveLectureCardKind(lecture: LectureListItem): LectureCardKind {
  const status = (lecture.status ?? "").toLowerCase().replace(/_/g, " ")
  const progress = clampLectureProgress(lecture.progress_percentage)

  if (
    status.includes("lock") ||
    status.includes("upcoming") ||
    status.includes("scheduled") ||
    status === "draft" ||
    status === "unpublished" ||
    status === "pending"
  ) {
    return "locked"
  }

  if (progress >= 100 || status.includes("complete")) return "completed"
  if (progress > 0 || status.includes("progress")) return "in_progress"
  return "available"
}

export function matchesLectureFilter(lecture: LectureListItem, filter: LectureFilter): boolean {
  if (filter === "all") return true
  return resolveLectureCardKind(lecture) === filter
}

export const LECTURE_FILTER_OPTIONS: Array<{ value: LectureFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "available", label: "Not started" },
  { value: "locked", label: "Locked" },
]
