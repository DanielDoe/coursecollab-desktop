import { ensureUtcDate } from "@/lib/timezone"
import type { DashboardActivityItem } from "@/lib/dashboard-v2/types"

export function assessmentTypeLabel(type?: string | null): string {
  switch (type) {
    case "homework":
      return "Homework"
    case "mid_semester":
      return "Mid-Semester"
    case "final":
      return "Final"
    case "quiz":
      return "Quiz"
    case "practice":
      return "Practice"
    default:
      return "Assessment"
  }
}

export type ActivityStatus = "submitted" | "saved_for_later" | "in_progress"

export function buildFacultyActivityTitle(input: {
  student_name?: string | null
  title?: string | null
  status?: string | null
}): string {
  const name = input.student_name?.trim() || "A student"
  const assessment = input.title?.trim() || "an assessment"
  switch (input.status) {
    case "submitted":
      return `${name} submitted ${assessment}`
    case "saved_for_later":
      return `${name} saved ${assessment} for later`
    case "in_progress":
      return `${name} is taking ${assessment}`
    default:
      return `${name} · ${assessment}`
  }
}

export function buildFacultyActivityMessage(input: {
  assessment_type?: string | null
  status?: string | null
  percentage?: number | string | null
  score?: number | string | null
}): string {
  const type = assessmentTypeLabel(input.assessment_type)
  if (input.status === "submitted") {
    const pct = Number(input.percentage)
    if (Number.isFinite(pct)) {
      const clamped = Math.min(100, Math.max(0, pct))
      return `${type} · ${clamped.toFixed(1)}%`
    }
    const pts = Number(input.score)
    if (Number.isFinite(pts)) return `${type} · ${pts.toFixed(1)} pts`
    return `${type} · Submitted`
  }
  if (input.status === "saved_for_later") return `${type} · Paused — can resume`
  if (input.status === "in_progress") return `${type} · In progress`
  return type
}

export function formatDashboardTimeAgo(dateStr?: string | null): string {
  if (!dateStr?.trim()) return "—"
  try {
    const date = ensureUtcDate(dateStr)
    if (Number.isNaN(date.getTime())) return "—"

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    if (diffMs < 0) return "Just now"

    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

export function facultyActivityHref(
  basePath: string,
  item: DashboardActivityItem,
): string | null {
  const attemptId = item.attempt_id ?? (item.type === "quiz_attempt" ? item.id : null)
  if (!attemptId) return null
  return `${basePath}/results/${attemptId}`
}
