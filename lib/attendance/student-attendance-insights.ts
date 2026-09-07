/** Common syllabus attendance floor — used for student-facing goal copy. */
export const DEFAULT_ATTENDANCE_GOAL_PCT = 90

export type AttendanceGoalInsight = {
  goalPct: number
  currentPct: number
  met: boolean
  sessionsNeeded: number
  message: string
}

export type WeekDayStatus = "present" | "absent" | "none"

export function sessionsNeededForGoal(
  attended: number,
  scoredSessions: number,
  goalPct: number = DEFAULT_ATTENDANCE_GOAL_PCT,
): number {
  if (scoredSessions <= 0) return 0
  const goal = goalPct / 100
  const current = attended / scoredSessions
  if (current >= goal) return 0
  const needed = (goal * scoredSessions - attended) / (1 - goal)
  return Math.ceil(Math.max(0, needed))
}

export function buildAttendanceGoalInsight(
  attended: number,
  scoredSessions: number,
  goalPct: number = DEFAULT_ATTENDANCE_GOAL_PCT,
): AttendanceGoalInsight {
  const currentPct = scoredSessions > 0 ? (attended / scoredSessions) * 100 : 0
  const sessionsNeeded = sessionsNeededForGoal(attended, scoredSessions, goalPct)
  const met = sessionsNeeded === 0 && scoredSessions > 0

  let message = "Mark your first session to start tracking toward your goal."
  if (scoredSessions > 0 && met) {
    message = `You're at or above ${goalPct}% — keep your streak alive.`
  } else if (scoredSessions > 0 && sessionsNeeded === 1) {
    message = `Attend your next class to reach ${goalPct}%.`
  } else if (scoredSessions > 0 && sessionsNeeded > 1) {
    message = `Attend the next ${sessionsNeeded} classes (if marked present) to reach ${goalPct}%.`
  } else if (scoredSessions > 0) {
    message = `You're at ${currentPct.toFixed(1)}% — every check-in counts.`
  }

  return { goalPct, currentPct, met, sessionsNeeded, message }
}

export function projectRateIfPresent(
  attended: number,
  scoredSessions: number,
  extraPresent: number,
): number {
  if (scoredSessions + extraPresent <= 0) return 0
  return ((attended + extraPresent) / (scoredSessions + extraPresent)) * 100
}

export function nextStreakMilestone(current: number): { target: number; remaining: number } | null {
  const milestones = [3, 5, 10, 15, 20]
  const target = milestones.find((m) => m > current)
  if (!target) return null
  return { target, remaining: target - current }
}

export function buildRecentWeekStrip(
  records: { startTime: string; status: string }[],
  days = 5,
): { label: string; status: WeekDayStatus }[] {
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const byDay = new Map<string, WeekDayStatus>()

  for (const record of records) {
    const d = new Date(record.startTime)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toDateString()
    const prev = byDay.get(key)
    if (record.status === "present") {
      byDay.set(key, "present")
    } else if (record.status === "absent" && prev !== "present") {
      byDay.set(key, "absent")
    }
  }

  const out: { label: string; status: WeekDayStatus }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const status = byDay.get(d.toDateString()) ?? "none"
    out.push({ label: dayLabels[d.getDay()] ?? "?", status })
  }
  return out
}

export function rankClimbHint(
  rank: number,
  totalPoints: number,
  leaderboard: { rank?: number; total_points?: number; totalPoints?: number }[],
): string | null {
  if (rank <= 1) return "You're at the top — defend your spot."
  const above = leaderboard.find((e) => Number(e.rank) === rank - 1)
  if (!above) return null
  const abovePts = Number(above.total_points ?? above.totalPoints) || 0
  const gap = abovePts - totalPoints
  if (gap <= 0) return "You're closing in on the next rank."
  return `${gap} pt${gap === 1 ? "" : "s"} to reach #${rank - 1}.`
}
