"use client"


import type { StudentDashboardStats } from "@/lib/dashboard-v2/types"
import { getStudentAuthHeaders } from "@/lib/auth"
import { resolveStudentGradeDisplay } from "@/lib/student-grade-display"
import { clampGradebookEngagementCredits } from "@/lib/engagement-points-system"
import { roundKpiNumber } from "@/lib/dashboard-v2/format-kpi-value"
import { cachedFetchJson, primeClientCache } from "@/lib/student-client-cache"

const TTL_MS = 180_000

function studentAuthInit(): RequestInit {
  return { headers: getStudentAuthHeaders() }
}

async function readJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, studentAuthInit())
  if (!res.ok) return null
  return res.json()
}

export function fetchCachedGrades(dbId: string, section: string) {
  return cachedFetchJson(
    `grades:${dbId}:${section}`,
    () => readJson(`/api/grades/student?studentId=${encodeURIComponent(dbId)}&session=${encodeURIComponent(section)}`),
    TTL_MS,
  )
}

export function fetchCachedQuizHistory(dbId: string) {
  return cachedFetchJson(
    `quiz-history:${dbId}`,
    () => readJson(`/api/student/quiz-history?studentId=${encodeURIComponent(dbId)}`),
    TTL_MS,
  )
}

export function fetchCachedHomeworkHistory(displayId: string, section: string) {
  return cachedFetchJson(
    `homework-history:${displayId}:${section}`,
    () =>
      readJson(
        `/api/student/homework-history?studentId=${encodeURIComponent(displayId)}&session=${encodeURIComponent(section)}`,
      ),
    TTL_MS,
  )
}

export function fetchCachedAttendance(dbId: string) {
  return cachedFetchJson(
    `attendance:${dbId}`,
    () => readJson(`/api/attendance/score?studentId=${encodeURIComponent(dbId)}`),
    TTL_MS,
  )
}

export function fetchCachedStreaks(dbId: string) {
  return cachedFetchJson(
    `attendance-streaks:${dbId}`,
    () => readJson(`/api/attendance/streaks?studentId=${encodeURIComponent(dbId)}`),
    TTL_MS,
  )
}

export function fetchCachedClassroomPoints(dbId: string, section: string) {
  const url =
    section && section !== "ALL"
      ? `/api/classroom-points?studentId=${encodeURIComponent(dbId)}&session=${encodeURIComponent(section)}`
      : `/api/classroom-points?studentId=${encodeURIComponent(dbId)}`
  return cachedFetchJson(`classroom-points:${dbId}:${section}`, () => readJson(url), TTL_MS)
}

function seedDashboardCaches(
  dbId: string,
  displayId: string,
  section: string,
  homeworkStudentId: string,
  bundle: Record<string, unknown>,
) {
  const gradePayload = bundle.gradePayload ?? null
  const quizPayload = { quizHistory: bundle.quizHistory ?? [] }
  const homeworkPayload = {
    homeworkHistory: bundle.homeworkHistory ?? [],
    stats: bundle.homeworkStats ?? { overdue: 0, pending: 0 },
  }
  const attendancePayload = bundle.attendance ? { attendance: bundle.attendance } : null
  const streaksPayload = { streak: { currentStreak: Number(bundle.attendanceStreak ?? 0) } }
  const quizzesPayload = { quizzes: bundle.upcomingQuizzes ?? [] }
  const pointsPayload = { summary: { total_points: Number(bundle.classroomPoints ?? 0) } }
  const finalsPayload = {
    finals: bundle.finalsTaken ? [{ status: "completed" }] : [],
  }

  primeClientCache(`grades:${dbId}:${section}`, gradePayload, TTL_MS)
  primeClientCache(`quiz-history:${dbId}`, quizPayload, TTL_MS)
  if (homeworkStudentId && section) {
    primeClientCache(`homework-history:${homeworkStudentId}:${section}`, homeworkPayload, TTL_MS)
  }
  primeClientCache(`attendance:${dbId}`, attendancePayload, TTL_MS)
  primeClientCache(`attendance-streaks:${dbId}`, streaksPayload, TTL_MS)
  primeClientCache(`quizzes-open:${dbId}`, quizzesPayload, TTL_MS)
  primeClientCache(`classroom-points:${dbId}:${section}`, pointsPayload, TTL_MS)
  primeClientCache(`finals:${displayId}:${section}`, finalsPayload, TTL_MS)

  return [
    gradePayload,
    quizPayload,
    homeworkPayload,
    attendancePayload,
    streaksPayload,
    quizzesPayload,
    pointsPayload,
  ] as const
}

export function fetchCachedFinals(displayId: string, section: string) {
  return cachedFetchJson(
    `finals:${displayId}:${section}`,
    () =>
      readJson(
        `/api/student/finals?session=${encodeURIComponent(section)}&studentId=${encodeURIComponent(displayId)}`,
      ),
    TTL_MS,
  )
}

export async function fetchStudentDashboardStats(
  dbId: string,
  displayId: string,
  section: string,
): Promise<StudentDashboardStats> {
  const cacheKey = `dashboard-stats:${dbId}:${section}:${displayId}`
  return cachedFetchJson(
    cacheKey,
    () => loadStudentDashboardStats(dbId, displayId, section),
    180_000,
  )
}

async function loadStudentDashboardStats(
  dbId: string,
  displayId: string,
  section: string,
): Promise<StudentDashboardStats> {
  const homeworkStudentId = displayId || dbId
  const bundle = await readJson(
    `/api/student/dashboard-stats?studentId=${encodeURIComponent(dbId)}&session=${encodeURIComponent(section)}`,
  )
  const [gradePayload, quizPayload, homeworkPayload, attendancePayload, streaksPayload, quizzesPayload, pointsPayload] =
    bundle && typeof bundle === "object" && "gradePayload" in bundle
      ? seedDashboardCaches(dbId, displayId, section, homeworkStudentId, bundle as Record<string, unknown>)
      : await Promise.all([
          fetchCachedGrades(dbId, section).catch(() => null),
          fetchCachedQuizHistory(dbId).catch(() => null),
          homeworkStudentId && section
            ? fetchCachedHomeworkHistory(homeworkStudentId, section).catch(() => null)
            : Promise.resolve(null),
          fetchCachedAttendance(dbId).catch(() => null),
          fetchCachedStreaks(dbId).catch(() => null),
          cachedFetchJson(
            `quizzes-open:${dbId}`,
            () => readJson(`/api/student/quizzes?studentDatabaseId=${encodeURIComponent(dbId)}&assessmentType=quiz`),
            TTL_MS,
          ).catch(() => null),
          fetchCachedClassroomPoints(dbId, section).catch(() => null),
        ])

  let overallGrade = 0
  let letterGrade = "—"
  let quizAverage = 0
  let classQuizAverage = 80
  let homeworkAverage = 0
  let missingAssignments = 0
  let attendancePct = 0
  let classesMissed = 0
  let attendanceStreak = 0
  let classroomPoints = 0
  let engagementCredits = 0
  let upcomingDeadlines = 0
  const now = new Date()

  if (gradePayload && typeof gradePayload === "object") {
    const display = resolveStudentGradeDisplay(gradePayload)
    overallGrade = roundKpiNumber(display.totalScore)
    letterGrade = display.letterLabel
    const { grade, classAverages } = gradePayload as {
      grade?: { engagement_credits?: number }
      classAverages?: { avg_quiz?: number }
    }
    if (classAverages?.avg_quiz != null) {
      classQuizAverage = roundKpiNumber(Number(classAverages.avg_quiz))
    }
    engagementCredits = clampGradebookEngagementCredits(grade?.engagement_credits)
  }

  if (quizPayload && typeof quizPayload === "object") {
    const { quizHistory } = quizPayload as {
      quizHistory?: { attempts?: { percentage: number }[] }[]
    }
    const allScores: number[] = []
    for (const q of quizHistory || []) {
      const best =
        q.attempts?.reduce(
          (max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0),
          0,
        ) ?? 0
      if (best > 0) allScores.push(best)
    }
    quizAverage =
      allScores.length > 0
        ? roundKpiNumber(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0
  }

  if (homeworkPayload && typeof homeworkPayload === "object") {
    const { homeworkHistory, stats } = homeworkPayload as {
      homeworkHistory?: { status: string; available_until?: string; attempts?: { percentage: number }[] }[]
      stats?: { overdue?: number; pending?: number }
    }
    const completed = (homeworkHistory || []).filter((h) => h.status === "completed")
    const scores = completed
      .map((h) => {
        const best =
          h.attempts?.reduce(
            (max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0),
            0,
          ) ?? 0
        return best
      })
      .filter((s: number) => s > 0)
    homeworkAverage =
      scores.length > 0
        ? roundKpiNumber(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
        : 0
    missingAssignments = (stats?.overdue ?? 0) + (stats?.pending ?? 0)
    upcomingDeadlines += (homeworkHistory || []).filter(
      (h) => h.status !== "completed" && h.available_until && new Date(h.available_until) > now,
    ).length
  }

  if (attendancePayload && typeof attendancePayload === "object") {
    const { attendance } = attendancePayload as {
      attendance?: {
        attendance_percentage?: number
        sessions_scored_so_far?: number
        total_classes?: number
        classes_attended?: number
      }
    }
    if (attendance) {
      attendancePct = roundKpiNumber(Number(attendance.attendance_percentage ?? 0))
      const scored = Number(attendance.sessions_scored_so_far ?? attendance.total_classes ?? 0)
      const attended = Number(attendance.classes_attended ?? 0)
      classesMissed = Math.max(0, scored - attended)
    }
  }

  if (streaksPayload && typeof streaksPayload === "object") {
    const json = streaksPayload as { streak?: { currentStreak?: number } }
    attendanceStreak = Number(json?.streak?.currentStreak ?? 0)
  }

  if (pointsPayload && typeof pointsPayload === "object") {
    const { summary } = pointsPayload as { summary?: { total_points?: number } }
    classroomPoints = roundKpiNumber(Number(summary?.total_points ?? 0))
  }

  if (quizzesPayload && typeof quizzesPayload === "object") {
    const { quizzes } = quizzesPayload as { quizzes?: { available_until?: string }[] }
    upcomingDeadlines += (quizzes || []).filter((q) => {
      if (!q.available_until) return false
      return new Date(q.available_until) > now
    }).length
  }

  let riskLevel: StudentDashboardStats["riskLevel"] = "low"
  let riskReason = "Grades and attendance on track."

  if (overallGrade >= 85 && attendancePct >= 90 && missingAssignments === 0) {
    riskLevel = "low"
    riskReason = "Grades and attendance on track."
  } else if (overallGrade >= 70 && attendancePct >= 80) {
    riskLevel = "moderate"
    const reasons: string[] = []
    if (overallGrade < 85) reasons.push("grade below 85%")
    if (attendancePct < 90) reasons.push("attendance below 90%")
    if (missingAssignments > 0) reasons.push(`${missingAssignments} missing`)
    riskReason = reasons.length ? `Focus on: ${reasons.join(", ")}` : "Room to improve."
  } else {
    riskLevel = "high"
    const reasons: string[] = []
    if (overallGrade < 70) reasons.push("grade below 70%")
    if (attendancePct < 80) reasons.push("attendance below 80%")
    if (missingAssignments > 0) reasons.push(`${missingAssignments} missing`)
    riskReason = `Action needed: ${reasons.join(", ")}`
  }

  return {
    overallGrade,
    letterGrade,
    quizAverage,
    classQuizAverage,
    homeworkAverage,
    missingAssignments,
    attendancePct,
    classesMissed,
    attendanceStreak,
    classroomPoints,
    engagementCredits,
    upcomingDeadlines,
    riskLevel,
    riskReason,
  }
}

export function mapCamperHubToStats(hub: Record<string, unknown>): import("@/lib/dashboard-v2/types").CamperDashboardStats {
  const progress = (hub.progress as Array<{ completed_modules?: number; total_modules?: number }>) ?? []
  const modulesCompleted = progress.reduce((sum, p) => sum + (p.completed_modules ?? 0), 0)
  const totalModules = progress.reduce((sum, p) => sum + (p.total_modules ?? 0), 0)

  return {
    overallPercent: roundKpiNumber(Number(hub.overall_percent ?? 0)),
    totalXp: Number(hub.total_xp ?? 0),
    leaderboardRank: hub.leaderboard_rank != null ? Number(hub.leaderboard_rank) : null,
    leaderboardTotal: hub.leaderboard_total != null ? Number(hub.leaderboard_total) : null,
    enrollmentCount: Array.isArray(hub.enrollments) ? hub.enrollments.length : 0,
    pendingCheckpoints: Array.isArray(hub.upcoming_checkpoints) ? hub.upcoming_checkpoints.length : 0,
    modulesCompleted,
    totalModules,
    recentFeedbackCount: Array.isArray(hub.recent_feedback) ? hub.recent_feedback.length : 0,
    openDiscussions: Array.isArray(hub.recent_discussions) ? hub.recent_discussions.length : 0,
    upcomingEvents: Array.isArray(hub.upcoming_events) ? hub.upcoming_events.length : 0,
  }
}
