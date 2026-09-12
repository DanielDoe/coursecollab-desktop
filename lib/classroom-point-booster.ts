import {
  ECE2202_LECTURE7_CLASSROOM_DUE_CT,
  isEce2202Lecture7ClassroomSubmission,
} from "@/lib/classroom-submission-availability"

/** Base classroom submission points before timing booster (not CodeBench x2). */
export const CLASSROOM_BASE_POINTS = 2.5

/**
 * Timing booster from when the assignment was posted:
 * - within 24h of created/opened → x3
 * - 24–48h after opened (next day) → x2
 * - later → x1
 */
export function getTimingBoosterSinceOpened(
  openedAt: Date | string | null | undefined,
  submittedAt: Date | string = new Date(),
): number {
  if (!openedAt) return 1
  const openMs = new Date(openedAt).getTime()
  const atMs = new Date(submittedAt).getTime()
  if (!Number.isFinite(openMs) || !Number.isFinite(atMs)) return 1
  const hoursSinceOpen = (atMs - openMs) / (1000 * 60 * 60)
  if (hoursSinceOpen < 0) return 3
  if (hoursSinceOpen <= 24) return 3
  if (hoursSinceOpen <= 48) return 2
  return 1
}

/** @deprecated Deadline-relative booster. Use getTimingBoosterSinceOpened. */
export function getTimingBoosterAt(
  openedAt: Date | string | null | undefined,
  atTime: Date | string = new Date(),
): number {
  return getTimingBoosterSinceOpened(openedAt, atTime)
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
  if (booster === 3) return "x3 (submitted within 24hrs)"
  if (booster === 2) return "x2 (submitted the next day)"
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

/**
 * Recompute stored points when a timing booster was missing or too low.
 * Never lowers an existing award.
 */
export function applyTimingBoosterBackfill(opts: {
  storedPoints: number
  storedBooster: number
  nextBooster: number
}): { points: number; booster: number; changed: boolean } {
  const storedBooster = Math.max(1, Number(opts.storedBooster) || 1)
  const nextBooster = Math.max(1, Number(opts.nextBooster) || 1)
  const stored = Number(opts.storedPoints) || 0
  const looksUnboosted = stored > 0 && stored <= CLASSROOM_BASE_POINTS + 0.01
  const base = looksUnboosted
    ? stored
    : storedBooster > 1
      ? stored / storedBooster
      : stored
  const nextPoints = classroomPointsWithBooster(
    Number.isFinite(base) && base > 0 ? Math.min(CLASSROOM_BASE_POINTS, base) : CLASSROOM_BASE_POINTS,
    nextBooster,
  )
  const points = Math.max(stored, nextPoints)
  const booster = Math.max(storedBooster, nextBooster)
  const changed = points > stored + 0.001 || booster !== storedBooster
  return { points: Number.parseFloat(points.toFixed(2)), booster, changed }
}

/** Booster at the moment the student submitted, from assignment created/opened time. */
export function resolveClassroomSubmissionBooster(opts: {
  submissionId?: number | null
  deadline?: Date | string | null
  openedAt?: Date | string | null
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

  return getTimingBoosterSinceOpened(opts.openedAt ?? null, opts.submittedAt ?? new Date())
}
