/** Client-safe Course Exchange provenance helpers. */

import type { CourseExchangeModule } from "@/lib/course-exchange/types"

export type ExchangeProvenance = {
  sourceInstructorName: string
  sourceCourseCode: string
  sourceCourseTitle: string
  sourceTermLabel?: string | null
  destinationInstructorName?: string | null
  copiedAt: string
  requestId: number
}

export const EXCHANGE_INDEPENDENT_COPY_NOTE =
  "This is an independent copy. Edits here never change the creator's original course, and updates to the source are not synced automatically. Student rosters, grades, and point history are never copied — only teaching materials."

export const EXCHANGE_CLASSROOM_POINTS_NOTE =
  "Classroom Points copies assignment templates only. Student awards, submissions, and leaderboard history stay in the source section."

export const EXCHANGE_PARTIAL_MODULES_NOTE =
  "Request only the modules you need for your term. Fewer modules means a leaner copy and less to review before launch."

export const EXCHANGE_DESTINATION_SHELL_NOTE =
  "Import into a dedicated course shell for your institution and term (for example ECE2202UH · Summer 2026). Avoid reusing a live roster course."

export const EXCHANGE_OWNER_SHARING_NOTE =
  "Approved requesters receive a one-time fork into their own course. Their edits never flow back to your original, and you are not notified when they change their copy."

export const EXCHANGE_POST_IMPORT_CHECKLIST = [
  "Syllabus dates",
  "Assessment availability",
  "Due dates",
  "Lecture schedule",
  "Grading policies",
  "Classroom Points",
  "Practice settings",
  "Publish status",
] as const

const CLONE_SUMMARY_LABELS: Record<string, string> = {
  question_bank: "questions",
  syllabus: "syllabus",
  lectures: "lectures",
  course_notes: "notes",
  flashcards: "flashcard decks",
  practice_availability: "practice links",
  assessments: "assessments",
  course_policies: "policy sets",
  playground_sessions: "playground templates",
  groups: "groups",
  projects: "projects",
}

export function formatExchangeSourceLine(provenance: ExchangeProvenance): string {
  const term = provenance.sourceTermLabel ? ` · ${provenance.sourceTermLabel}` : ""
  return `${provenance.sourceInstructorName} · ${provenance.sourceCourseCode}${provenance.sourceCourseTitle ? ` — ${provenance.sourceCourseTitle}` : ""}${term}`
}

export function formatExchangeCopiedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function summarizeCloneCounts(summary: Record<string, unknown> | null | undefined): string {
  if (!summary) return ""
  const parts: string[] = []
  for (const [key, raw] of Object.entries(summary)) {
    const count = Number(raw)
    if (!Number.isFinite(count) || count <= 0) continue
    const label = CLONE_SUMMARY_LABELS[key] ?? key.replace(/_/g, " ")
    parts.push(`${count} ${label}`)
  }
  return parts.join(" · ")
}

export function exchangeMissingShareableModules(
  shareableModules: CourseExchangeModule[],
  importedModules: CourseExchangeModule[],
): CourseExchangeModule[] {
  const imported = new Set(importedModules)
  return shareableModules.filter((mod) => !imported.has(mod))
}

export function exchangePendingSupplementModules(
  requestedModules: CourseExchangeModule[],
  copyApprovedModules: CourseExchangeModule[] | null | undefined,
): CourseExchangeModule[] {
  if (!copyApprovedModules?.length) return []
  const imported = new Set(copyApprovedModules)
  return requestedModules.filter((mod) => !imported.has(mod))
}

export function requestNeedsCreatorReview(
  status: string,
  requestedModules: CourseExchangeModule[],
  copyApprovedModules: CourseExchangeModule[] | null | undefined,
): boolean {
  if (status.toUpperCase() === "PENDING") return true
  return exchangePendingSupplementModules(requestedModules, copyApprovedModules).length > 0
}

export function parseExchangeProvenance(raw: unknown): ExchangeProvenance | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const sourceInstructorName = String(o.sourceInstructorName ?? "").trim()
  const sourceCourseCode = String(o.sourceCourseCode ?? "").trim()
  const sourceCourseTitle = String(o.sourceCourseTitle ?? "").trim()
  const copiedAt = String(o.copiedAt ?? "").trim()
  const requestId = Number(o.requestId)
  if (!sourceInstructorName || !sourceCourseCode || !copiedAt || !Number.isFinite(requestId)) return null
  return {
    sourceInstructorName,
    sourceCourseCode,
    sourceCourseTitle,
    sourceTermLabel: o.sourceTermLabel != null ? String(o.sourceTermLabel) : null,
    destinationInstructorName:
      o.destinationInstructorName != null ? String(o.destinationInstructorName) : null,
    copiedAt,
    requestId,
  }
}
