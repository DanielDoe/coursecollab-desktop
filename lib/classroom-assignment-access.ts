import {
  classroomAssignmentIsOpen,
  classroomAssignmentOpenState,
  formatAssignmentDueLabel,
} from "@/lib/classroom-submission-availability"

export type ClassroomAssignmentRow = {
  id: number
  title: string
  expires_at?: string | null
  due_at?: string | null
  duration_hours?: number | null
  created_at?: string | null
  is_active?: boolean
  attempted?: boolean
  pending?: boolean
  submission_kind?: string
}

export type ClassroomSubmissionsSnapshot = {
  available: ClassroomAssignmentRow[]
  pending: ClassroomAssignmentRow[]
  missing: ClassroomAssignmentRow[]
}

export type ClassroomAccessLockReason =
  | "deadline_passed"
  | "pending_review"
  | "already_submitted"
  | "removed"

export type ClassroomAccessNotice = {
  channel: "code" | "solution"
  reason: ClassroomAccessLockReason
  assignmentId: number
  assignmentTitle: string
  title: string
  description: string
  deadlineLabel: string | null
}

export function isClassroomAssignmentPastDue(
  submission: {
    is_active?: boolean
    expires_at?: string | null
    due_at?: string | Date | null
    duration_hours?: number | null
    created_at?: string | Date | null
  } | null | undefined,
): boolean {
  if (!submission) return false
  return classroomAssignmentOpenState(submission) === "expired"
}

export function findAssignmentInSnapshot(
  assignmentId: number,
  snapshot: ClassroomSubmissionsSnapshot,
): ClassroomAssignmentRow | undefined {
  return (
    snapshot.available.find((a) => a.id === assignmentId) ||
    snapshot.missing.find((a) => a.id === assignmentId) ||
    snapshot.pending.find((a) => a.id === assignmentId)
  )
}

/** Student can still upload and submit for this assignment. */
export function isClassroomAssignmentSubmittable(
  assignmentId: number,
  snapshot: ClassroomSubmissionsSnapshot,
): boolean {
  if (snapshot.available.some((a) => a.id === assignmentId)) return true
  const missing = snapshot.missing.find((a) => a.id === assignmentId)
  return Boolean(missing && !isClassroomAssignmentPastDue(missing))
}

export function buildClassroomSubmissionsSnapshot(data: {
  submissions?: ClassroomAssignmentRow[]
  pendingSubmissions?: ClassroomAssignmentRow[]
  missingSubmissions?: ClassroomAssignmentRow[]
}): ClassroomSubmissionsSnapshot {
  const allSubmissions = data.submissions ?? []
  const pendingIds = new Set((data.pendingSubmissions ?? []).map((s) => s.id))
  const attemptedIds = new Set(allSubmissions.filter((s) => s.attempted).map((s) => s.id))

  const available = allSubmissions.filter((sub) => {
    const isOpen = classroomAssignmentIsOpen(sub)
    const isAttempted = attemptedIds.has(sub.id)
    return isOpen && !isAttempted
  })

  return {
    available,
    pending: data.pendingSubmissions ?? [],
    missing: (data.missingSubmissions ?? []).filter((sub) => classroomAssignmentIsOpen(sub)),
  }
}

function deadlineLabelFor(row: ClassroomAssignmentRow | undefined): string | null {
  if (!row) return null
  return formatAssignmentDueLabel(row.due_at ?? row.expires_at, row.expires_at)
}

export function getClassroomAccessLockExplanation(
  assignmentId: number,
  snapshot: ClassroomSubmissionsSnapshot,
  channel: "code" | "solution",
): ClassroomAccessNotice | null {
  if (isClassroomAssignmentSubmittable(assignmentId, snapshot)) return null

  const row = findAssignmentInSnapshot(assignmentId, snapshot)
  const assignmentTitle = row?.title ?? "This assignment"
  const deadlineLabel = deadlineLabelFor(row)
  const channelLabel = channel === "solution" ? "worked solution" : "code"

  if (snapshot.pending.some((a) => a.id === assignmentId)) {
    return {
      channel,
      reason: "pending_review",
      assignmentId,
      assignmentTitle,
      deadlineLabel,
      title: "Submission locked — already submitted",
      description: `You already submitted your ${channelLabel} for "${assignmentTitle}".${
        deadlineLabel ? ` The deadline was ${deadlineLabel}.` : ""
      } Your work is awaiting review — you cannot submit again. This is normal course policy, not a software bug.`,
    }
  }

  if (row && isClassroomAssignmentPastDue(row)) {
    return {
      channel,
      reason: "deadline_passed",
      assignmentId,
      assignmentTitle,
      deadlineLabel,
      title: "Deadline passed — submission closed",
      description: `"${assignmentTitle}" closed${
        deadlineLabel ? ` at ${deadlineLabel}` : ""
      }. Any ${channelLabel} still in the editor was not saved as a submission — only work you click Submit counts. If you were working when the deadline hit, contact your instructor for an extension. This is not a random logout or app error.`,
    }
  }

  if (row?.attempted) {
    return {
      channel,
      reason: "already_submitted",
      assignmentId,
      assignmentTitle,
      deadlineLabel,
      title: "Already submitted",
      description: `You already completed "${assignmentTitle}". Each assignment accepts one submission only.`,
    }
  }

  return {
    channel,
    reason: "removed",
    assignmentId,
    assignmentTitle,
    deadlineLabel,
    title: "Assignment no longer available",
    description: `"${assignmentTitle}" is no longer open for submission.${
      deadlineLabel ? ` It closed at ${deadlineLabel}.` : ""
    } Draft ${channelLabel} in the editor is not auto-submitted. Contact your instructor if you need more time.`,
  }
}

export function resolveActiveAssignmentId(
  activeId: string | undefined,
  missingId: string | undefined,
): number | null {
  const raw = (activeId || missingId || "").trim()
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) ? id : null
}
