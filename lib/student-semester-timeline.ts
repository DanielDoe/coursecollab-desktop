/** Unified semester timeline — assessments + syllabus dates, including not-yet-open work. */

import { buildAssessmentHubItem, type StudentAssessmentHubType } from "@/lib/student-assessment-hub"
import type { SyllabusDeadlineRow } from "@/lib/calendar/syllabus-deadlines"

export type SemesterTimelineStatus =
  | "coming_soon"
  | "open"
  | "past_due"
  | "completed"
  | "syllabus"

export type SemesterTimelineItem = {
  id: string
  title: string
  type: StudentAssessmentHubType | "syllabus"
  status: SemesterTimelineStatus
  /** Primary sort key (opensAt, dueDate, or syllabus date) */
  sortAt: string
  opensAt?: string
  dueDate?: string
  instructions?: string
  href?: string
  moduleHref?: string
  source: "assessment" | "syllabus"
  assessmentId?: number
  gradeReleased?: boolean
  score?: number
  syllabusSource?: string
  dateLabel?: string
}

type AssessmentFeedRow = {
  id: number
  title?: string
  description?: unknown
  available_from?: string | null
  available_until?: string | null
  expires_at?: string | null
  completed?: boolean
  can_take?: boolean
  session_active?: boolean
  session_access_active?: boolean
  calendar_open?: boolean
  grade_released?: boolean
  score?: number
  status?: string
  is_active?: boolean
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function datesWithinDays(a: Date | null, b: Date | null, days = 2): boolean {
  if (!a || !b) return false
  return Math.abs(a.getTime() - b.getTime()) <= days * 86400000
}

export function resolveAssessmentTimelineStatus(
  row: AssessmentFeedRow,
  now: Date,
): SemesterTimelineStatus {
  if (row.completed === true || row.status === "completed") return "completed"

  const opensAt = row.available_from ? new Date(row.available_from) : null
  const due = row.available_until ? new Date(row.available_until) : null

  if (opensAt && opensAt.getTime() > now.getTime()) return "coming_soon"

  const sessionOn = row.session_active === true || row.session_access_active === true
  if (!sessionOn && (opensAt || due)) {
    if (!due || due.getTime() > now.getTime()) return "coming_soon"
  }

  if (due && due.getTime() < now.getTime()) return "past_due"

  if (row.can_take === true) return "open"

  if (sessionOn && due && due.getTime() >= now.getTime()) return "open"

  if (opensAt || due) return "coming_soon"

  return "coming_soon"
}

function sortKeyForAssessment(row: AssessmentFeedRow, status: SemesterTimelineStatus): string {
  const opens = row.available_from ?? undefined
  const due = row.available_until ?? row.expires_at ?? undefined
  if (status === "coming_soon" && opens) return opens
  if (due) return due
  if (opens) return opens
  return new Date().toISOString()
}

function assessmentToTimelineItem(
  row: AssessmentFeedRow,
  type: StudentAssessmentHubType,
  idPrefix: string,
  now: Date,
): SemesterTimelineItem | null {
  const opens = row.available_from ?? undefined
  const due = row.available_until ?? row.expires_at ?? undefined
  if (!opens && !due && row.completed !== true) return null

  const status = resolveAssessmentTimelineStatus(row, now)
  const hub = buildAssessmentHubItem({
    type,
    id: row.id,
    title: row.title,
    description: row.description,
    available_from: row.available_from,
    available_until: row.available_until ?? row.expires_at,
    status: status === "coming_soon" ? "coming_soon" : status === "open" ? "pending" : "open",
    idPrefix,
  })

  return {
    id: hub.id,
    title: hub.title,
    type,
    status,
    sortAt: sortKeyForAssessment(row, status),
    opensAt: opens,
    dueDate: due,
    instructions: hub.instructions,
    href: status === "coming_soon" ? hub.moduleHref : hub.href,
    moduleHref: hub.moduleHref,
    source: "assessment",
    assessmentId: row.id,
    gradeReleased: row.grade_released === true,
    score: typeof row.score === "number" ? row.score : undefined,
  }
}

function syllabusToTimelineItem(row: SyllabusDeadlineRow): SemesterTimelineItem | null {
  if (!row.parsedDate) return null
  return {
    id: `syllabus-${row.key}`,
    title: row.title,
    type: "syllabus",
    status: "syllabus",
    sortAt: row.parsedDate.toISOString(),
    dueDate: row.parsedDate.toISOString(),
    dateLabel: row.dateText,
    instructions: `From syllabus: ${row.source}`,
    href: "/student/dashboard-v2/syllabus",
    moduleHref: "/student/dashboard-v2/syllabus",
    source: "syllabus",
    syllabusSource: row.source,
  }
}

function pushUniqueAssessment(
  map: Map<number, SemesterTimelineItem>,
  row: AssessmentFeedRow,
  type: StudentAssessmentHubType,
  idPrefix: string,
  now: Date,
) {
  const item = assessmentToTimelineItem(row, type, idPrefix, now)
  if (!item) return
  const existing = map.get(row.id)
  if (!existing || new Date(item.sortAt).getTime() < new Date(existing.sortAt).getTime()) {
    map.set(row.id, item)
  }
}

export function buildSemesterTimeline(input: {
  quizzes: AssessmentFeedRow[]
  homeworkAssessments: AssessmentFeedRow[]
  homeworkHistory: AssessmentFeedRow[]
  midSemesters: AssessmentFeedRow[]
  finals: AssessmentFeedRow[]
  missingSubmissions: AssessmentFeedRow[]
  syllabusDeadlines: SyllabusDeadlineRow[]
  now?: Date
}): SemesterTimelineItem[] {
  const now = input.now ?? new Date()
  const byAssessmentId = new Map<number, SemesterTimelineItem>()

  for (const q of input.quizzes) {
    pushUniqueAssessment(byAssessmentId, q, "quiz", "quiz", now)
  }
  for (const h of input.homeworkAssessments) {
    pushUniqueAssessment(byAssessmentId, h, "homework", "hw", now)
  }
  for (const h of input.homeworkHistory) {
    pushUniqueAssessment(byAssessmentId, h, "homework", "hw", now)
  }
  for (const m of input.midSemesters) {
    pushUniqueAssessment(byAssessmentId, m, "midterm", "mid", now)
  }
  for (const f of input.finals) {
    pushUniqueAssessment(byAssessmentId, f, "final", "final", now)
  }
  for (const s of input.missingSubmissions) {
    if (s.is_active === false) continue
    pushUniqueAssessment(byAssessmentId, s, "code_submission", "sub", now)
  }

  const assessmentItems = [...byAssessmentId.values()]

  const syllabusItems: SemesterTimelineItem[] = []
  for (const row of input.syllabusDeadlines) {
    const item = syllabusToTimelineItem(row)
    if (!item) continue
    const dup = assessmentItems.some((a) => {
      const aDue = a.dueDate ? new Date(a.dueDate) : null
      const sDue = item.dueDate ? new Date(item.dueDate) : null
      return titlesSimilar(a.title, item.title) && datesWithinDays(aDue, sDue)
    })
    if (!dup) syllabusItems.push(item)
  }

  return [...assessmentItems, ...syllabusItems].sort(
    (a, b) => new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime(),
  )
}

export function filterTimelineByStatus(
  items: SemesterTimelineItem[],
  filter: "all" | SemesterTimelineStatus,
): SemesterTimelineItem[] {
  if (filter === "all") return items
  return items.filter((i) => i.status === filter)
}

export function timelineStatusLabel(status: SemesterTimelineStatus): string {
  switch (status) {
    case "coming_soon":
      return "Coming soon"
    case "open":
      return "Open"
    case "past_due":
      return "Past due"
    case "completed":
      return "Completed"
    case "syllabus":
      return "Syllabus"
  }
}

export const TIMELINE_TYPE_LABELS: Record<
  StudentAssessmentHubType | "syllabus",
  string
> = {
  quiz: "Quiz",
  homework: "Homework",
  midterm: "Midterm",
  final: "Final",
  code_submission: "Classroom",
  syllabus: "Syllabus",
}
