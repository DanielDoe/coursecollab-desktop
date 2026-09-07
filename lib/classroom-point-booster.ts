import {
  ECE2202_LECTURE7_CLASSROOM_DUE_CT,
  isEce2202Lecture7ClassroomSubmission,
  originalDueForTimingBooster,
} from "@/lib/classroom-submission-availability"

/** Base classroom submission points before timing booster (not CodeBench x2). */
export const CLASSROOM_BASE_POINTS = 2.5

/**
 * Timing booster at submission time:
 * - within 24h of deadline → x3
 * - within 48h of deadline → x2
 * - otherwise x1 (late submissions also x1)
 */
export function getTimingBoosterAt(
  deadline: Date | string | null | undefined,
  atTime: Date | string = new Date(),
): number {
  if (!deadline) return 1
  const deadlineMs = new Date(deadline).getTime()
  const atMs = new Date(atTime).getTime()
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(atMs)) return 1
  const hoursUntilDeadline = (deadlineMs - atMs) / (1000 * 60 * 60)
  if (hoursUntilDeadline < 0) return 1
  if (hoursUntilDeadline <= 24) return 3
  if (hoursUntilDeadline <= 48) return 2
  return 1
}

export function classroomBasePointsFromScorePercent(scorePercent: number): number {
  const pct = Number(scorePercent)
  if (!Number.isFinite(pct)) return 0
  return Number.parseFloat(
    Math.max(0, Math.min(CLASSROOM_BASE_POINTS, (pct / 100) * CLASSROOM_BASE_POINTS)).toFixed(2),
  )
}

export function classroomPointsWithBooster(basePoints: number, booster: number): number {
  const base = Math.max(0, Math.min(CLASSROOM_BASE_POINTS, Number(basePoints) || 0))
  const mult = Math.max(1, Number(booster) || 1)
  return Number.parseFloat((base * mult).toFixed(2))
}

export function classroomPointsFromAiScorePercent(scorePercent: number, booster: number): number {
  return classroomPointsWithBooster(classroomBasePointsFromScorePercent(scorePercent), booster)
}

export function timingBoosterLabel(booster: number): string {
  if (booster === 3) return "x3 (within 24hrs of deadline)"
  if (booster === 2) return "x2 (within 48hrs of deadline)"
  return "x1"
}

export function formatClassroomPointsBoosterBadgeText(points: number, booster: number): string {
  const pts = Number(points)
  const b = Math.max(1, Number(booster) || 1)
  const ptsStr = Number.isFinite(pts)
    ? Number.parseFloat(pts.toFixed(2)).toString()
    : "0"
  return `${ptsStr} pts (${timingBoosterLabel(b)})`
}

/** Points shown in UI when stored value is unboosted base (2.5) but a timing booster applies. */
export function resolveClassroomDisplayPoints(
  points: number,
  pointBooster?: number | null,
): number {
  const booster = Math.max(1, Number(pointBooster) || 1)
  const stored = Number(points) || 0
  if (stored > 0) {
    const boostedBase = classroomPointsWithBooster(CLASSROOM_BASE_POINTS, booster)
    if (stored <= CLASSROOM_BASE_POINTS + 0.01) return boostedBase
    return stored
  }
  return classroomPointsWithBooster(CLASSROOM_BASE_POINTS, booster)
}

/** Booster at the moment the student submitted (uses original due date when assignment was extended). */
export function resolveClassroomSubmissionBooster(opts: {
  submissionId?: number | null
  deadline?: Date | string | null
  submittedAt?: Date | string | null
}): number {
  // Lecture 7 / Ch.7: agreed flat x3 for any on-time submission (not the usual 24h window).
  if (isEce2202Lecture7ClassroomSubmission(opts.submissionId)) {
    const due = opts.deadline ?? ECE2202_LECTURE7_CLASSROOM_DUE_CT
    const at = new Date(opts.submittedAt ?? new Date())
    const dueMs = new Date(due).getTime()
    if (Number.isFinite(dueMs) && at.getTime() <= dueMs) return 3
    return 1
  }

  const boosterDeadline =
    originalDueForTimingBooster(opts.submissionId ?? null) ?? opts.deadline ?? null
  return getTimingBoosterAt(boosterDeadline, opts.submittedAt ?? new Date())
}
