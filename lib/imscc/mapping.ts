import { fileExt } from "@/lib/imscc/html"
import type { CourseCollabTarget, ImsccKind } from "@/lib/imscc/types"

const BLOCKED_EXTS = new Set(["exe", "bat", "cmd", "msi", "scr", "com", "dll", "ps1", "sh"])

const LARGE_MEDIA_EXTS = new Set(["mp4", "mov", "m4v", "avi", "mkv", "webm", "mp3", "wav", "m4a"])
const NOTE_EXTS = new Set(["docx", "doc", "html", "htm", "txt", "md"])
const LARGE_MEDIA_BYTES = 8 * 1024 * 1024

export function isBlockedFile(name: string): boolean {
  return BLOCKED_EXTS.has(fileExt(name))
}

export function inferWeek(title: string): number | null {
  const m = title.match(/\bweek\s*(\d+)\b/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 1 && n <= 52 ? n : null
}

export function mapAssignmentGroup(title: string): {
  target: CourseCollabTarget
  kind: ImsccKind
  label: string
} {
  const t = title.toLowerCase()
  if (/\battendance\b/.test(t)) {
    return { target: "attendance", kind: "unsupported", label: "Attendance (use CourseCollab Attendance)" }
  }
  if (/classroom\s*point/.test(t)) {
    return {
      target: "classroom_points",
      kind: "unsupported",
      label: "Classroom Points (use CourseCollab Classroom Points)",
    }
  }
  if (/\bfinal/.test(t)) return { target: "final", kind: "assignment", label: "Final exam (draft)" }
  if (/mid[\s-]?sem/.test(t) || /\bmidterm\b/.test(t)) {
    return { target: "mid_semester", kind: "assignment", label: "Mid-semester exam (draft)" }
  }
  if (/\bquiz/.test(t)) return { target: "quizzes", kind: "assignment", label: "Quiz (draft)" }
  if (/\bproject\b/.test(t)) return { target: "homework", kind: "assignment", label: "Project / homework (draft)" }
  if (/\bhomework\b|\bhw\b/.test(t) || /^hw\d/i.test(t)) {
    return { target: "homework", kind: "assignment", label: "Homework (draft)" }
  }
  return { target: "homework", kind: "assignment", label: "Assignment (draft homework)" }
}

export function mapFile(name: string, bytes: number, moduleTitle?: string | null): {
  kind: ImsccKind
  target: CourseCollabTarget
  label: string
  selectedDefault: boolean
  blocked?: boolean
  blockReason?: string | null
} {
  if (isBlockedFile(name)) {
    return {
      kind: "file",
      target: "none",
      label: "Blocked executable",
      selectedDefault: false,
      blocked: true,
      blockReason: "Executables are never imported.",
    }
  }
  const ext = fileExt(name)
  if (ext === "ppt" || ext === "pptx") {
    return {
      kind: "lecture",
      target: "lectures",
      label: "Lecture / course content (draft)",
      selectedDefault: true,
    }
  }
  if (ext === "pdf" && moduleTitle && /\bweek\s*\d+/i.test(moduleTitle)) {
    return {
      kind: "lecture",
      target: "lectures",
      label: "Lecture / course content (draft)",
      selectedDefault: true,
    }
  }
  if (NOTE_EXTS.has(ext) && /note/i.test(name)) {
    return {
      kind: "file",
      target: "course_notes",
      label: "Course notes attachment (cataloged)",
      selectedDefault: true,
    }
  }
  if (LARGE_MEDIA_EXTS.has(ext) || bytes >= LARGE_MEDIA_BYTES) {
    return {
      kind: "file",
      target: "course_files",
      label: "Large media (not copied by default)",
      selectedDefault: false,
    }
  }
  return {
    kind: "file",
    target: "course_files",
    label: "Course file (cataloged)",
    selectedDefault: ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "pdf" || ext === "docx",
  }
}

export function parseCanvasCourseCode(raw: string, title?: string): { suggestedCode: string; termLabel: string | null } {
  const compact = raw.trim().replace(/\s+/g, "")
  const fromTitle = (title ?? "").trim().replace(/\s+/g, "")
  const term =
    compact.match(/^(Fall|Spring|Summer|Winter)(\d{4})[_-]/i) ??
    fromTitle.match(/^(Fall|Spring|Summer|Winter)(\d{4})[_-]/i) ??
    fromTitle.match(/(Fall|Spring|Summer|Winter)(\d{4})/i)
  const termLabel = term
    ? `${term[1][0].toUpperCase()}${term[1].slice(1).toLowerCase()} ${term[2]}`
    : null
  const afterTerm = compact.replace(/^(Fall|Spring|Summer|Winter)\d{4}[_-]*/i, "")
  const catalog = afterTerm.match(/^([A-Za-z]{2,6}\d{3,4})/)
  const fallback = afterTerm.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)
  return {
    suggestedCode: (catalog?.[1] ?? (fallback || "IMPORTED")).toUpperCase(),
    termLabel,
  }
}

export function humanCourseTitle(title: string, _code: string): string {
  return title.trim() || "Imported course"
}
