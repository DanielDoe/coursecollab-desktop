/**
 * Lecture list visuals — parity with course-collab-mobile/expo/src/lib/lecture-list-theme.ts
 */

import type { LucideIcon } from "lucide-react"
import { Clock, Lock, Play } from "lucide-react"
import { solidListThumb, type SolidListThumb } from "@/lib/student-color-hunt-theme"
import type { LectureCardKind } from "@/lib/lecture-list-utils"

export const SOLID_THUMB_LOCKED: SolidListThumb = {
  fill: "#636366",
  icon: "rgba(255,255,255,0.78)",
}

export function lectureSolidThumb(index: number, kind: LectureCardKind): SolidListThumb {
  if (kind === "locked") return SOLID_THUMB_LOCKED
  return solidListThumb(index)
}

export function lectureStatusAccent(kind: LectureCardKind, thumb: SolidListThumb): string {
  switch (kind) {
    case "completed":
      return "var(--cc-success)"
    case "in_progress":
      return "var(--cc-warning)"
    case "locked":
      return "var(--cc-text-muted)"
    default:
      return thumb.fill
  }
}

export function lectureThumbIcon(kind: LectureCardKind): LucideIcon {
  if (kind === "locked") return Lock
  if (kind === "in_progress") return Clock
  return Play
}

export function lectureStatusLabel(kind: LectureCardKind): string {
  switch (kind) {
    case "completed":
      return "Completed"
    case "in_progress":
      return "In Progress"
    case "locked":
      return "Locked"
    default:
      return "Not Started"
  }
}
