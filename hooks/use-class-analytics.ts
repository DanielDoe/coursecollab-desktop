"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getInstructorData } from "@/lib/auth"
import {
  buildClassAnalyticsRows,
  buildEngagementDistribution,
  computeClassAnalyticsOverview,
  filterClassAnalyticsRows,
  sortClassAnalyticsRows,
  type ClassAnalyticsSort,
  type ClassAnalyticsStudentRow,
} from "@/lib/class-analytics-utils"
import type {
  ClassAnalyticsAssessmentResult,
  ClassAnalyticsAttendanceSummary,
  ClassAnalyticsAttendanceTrendPoint,
  ClassAnalyticsInstructorStudent,
  ClassAnalyticsModuleFlashcardRow,
  ClassAnalyticsModuleLectureRow,
  ClassAnalyticsPlaygroundRow,
  ClassAnalyticsPointsRow,
  ClassAnalyticsPracticeRow,
} from "@/lib/class-analytics-types"
import type { ModuleStudentActivityPayload } from "@/lib/instructor-module-student-activity"

const RESULT_TYPES = ["quiz", "homework", "midsem", "final"] as const

function parseLectureCompleted(label: string): number {
  const match = label.match(/(\d+)\s+completed/)
  return match ? Number(match[1]) : 0
}

function parseStudyEvents(detail: string | null | undefined): number {
  if (!detail) return 0
  const match = detail.match(/(\d+)\s+study event/)
  return match ? Number(match[1]) : 0
}

function mapFlashcardActivity(payload: ModuleStudentActivityPayload | null): ClassAnalyticsModuleFlashcardRow[] {
  return (payload?.students ?? []).map((row) => ({
    studentDbId: row.studentDbId,
    decksStudied: row.activityCount,
    studyEvents: parseStudyEvents(row.detail),
    pointsAwarded: row.pointsAwarded,
  }))
}

function mapLectureActivity(payload: ModuleStudentActivityPayload | null): ClassAnalyticsModuleLectureRow[] {
  return (payload?.students ?? []).map((row) => ({
    studentDbId: row.studentDbId,
    lecturesOpened: row.activityCount,
    lecturesCompleted: parseLectureCompleted(row.activityLabel),
  }))
}

function mapPlaygroundActivity(body: {
  leaderboard?: Array<{
    studentId?: string
    score?: number
    sessionsPlayed?: number
    accuracyPercentage?: number
  }>
} | null): ClassAnalyticsPlaygroundRow[] {
  return (body?.leaderboard ?? []).map((row) => ({
    studentId: String(row.studentId ?? ""),
    sessionsPlayed: Number(row.sessionsPlayed ?? 1),
    totalScore: Number(row.score ?? 0),
    accuracy: row.accuracyPercentage != null ? Math.round(Number(row.accuracyPercentage)) : null,
  }))
}

async function fetchAssessmentResults(headers: Record<string, string>): Promise<ClassAnalyticsAssessmentResult[]> {
  const batches = await Promise.all(
    RESULT_TYPES.map(async (type) => {
      try {
        const res = await instructorApiFetch(`/api/${type}/results?showRetakes=true&limit=500`, { headers })
        if (!res.ok) return [] as ClassAnalyticsAssessmentResult[]
        const body = (await res.json()) as { results?: ClassAnalyticsAssessmentResult[] }
        return body.results ?? []
      } catch {
        return [] as ClassAnalyticsAssessmentResult[]
      }
    }),
  )
  return batches.flat()
}

export function useClassAnalytics(courseScopeVersion: number) {
  const [rows, setRows] = useState<ClassAnalyticsStudentRow[]>([])
  const [weeklyTrend, setWeeklyTrend] = useState<ClassAnalyticsAttendanceTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    setLoading(true)
    try {
      const headers = buildInstructorApiHeaders()
      const instructorId = getInstructorData()?.id ?? headers["x-instructor-id"]
      const courseId = headers["x-course-id"]

      const attendanceParams = new URLSearchParams()
      if (instructorId) attendanceParams.set("instructorId", String(instructorId))
      if (courseId) attendanceParams.set("courseId", courseId)

      const [
        rosterRes,
        practiceRes,
        pointsRes,
        attendanceRes,
        assessmentResults,
        flashcardsRes,
        lecturesRes,
        playgroundRes,
      ] = await Promise.all([
        instructorApiFetch("/api/instructor/students", { headers }),
        instructorApiFetch("/api/instructor/practice/student-progress", { headers }),
        instructorApiFetch("/api/classroom-points/summary", { headers }),
        fetch(`/api/attendance/analytics?${attendanceParams}`, { headers }).catch(() => null),
        fetchAssessmentResults(headers),
        instructorApiFetch("/api/instructor/module-student-activity?module=flashcards", { headers }).catch(() => null),
        instructorApiFetch("/api/instructor/module-student-activity?module=lectures", { headers }).catch(() => null),
        instructorApiFetch("/api/instructor/playground/leaderboard", { headers }).catch(() => null),
      ])

      const rosterBody = rosterRes.ok ? ((await rosterRes.json()) as { students?: ClassAnalyticsInstructorStudent[] }) : { students: [] }
      const practiceBody = practiceRes.ok
        ? ((await practiceRes.json()) as { students?: ClassAnalyticsPracticeRow[] })
        : { students: [] }
      const pointsBody = pointsRes.ok
        ? ((await pointsRes.json()) as { summary?: ClassAnalyticsPointsRow[] })
        : { summary: [] }

      let attendanceSummaries: ClassAnalyticsAttendanceSummary[] = []
      let trend: ClassAnalyticsAttendanceTrendPoint[] = []
      if (attendanceRes?.ok) {
        const attendanceBody = (await attendanceRes.json()) as {
          analytics?: {
            studentSummaries?: ClassAnalyticsAttendanceSummary[]
            weeklyTrend?: ClassAnalyticsAttendanceTrendPoint[]
          }
        }
        attendanceSummaries = attendanceBody.analytics?.studentSummaries ?? []
        trend = attendanceBody.analytics?.weeklyTrend ?? []
      }

      const flashcardsBody = flashcardsRes?.ok
        ? ((await flashcardsRes.json()) as ModuleStudentActivityPayload)
        : null
      const lecturesBody = lecturesRes?.ok
        ? ((await lecturesRes.json()) as ModuleStudentActivityPayload)
        : null
      const playgroundBody = playgroundRes?.ok
        ? ((await playgroundRes.json()) as { leaderboard?: ClassAnalyticsPlaygroundRow[] })
        : null

      const built = buildClassAnalyticsRows({
        roster: rosterBody.students ?? [],
        practice: practiceBody.students ?? [],
        attendanceSummaries,
        pointsSummary: pointsBody.summary ?? [],
        assessmentResults,
        flashcardActivity: mapFlashcardActivity(flashcardsBody),
        lectureActivity: mapLectureActivity(lecturesBody),
        playgroundActivity: mapPlaygroundActivity(playgroundBody),
      })

      setRows(built)
      setWeeklyTrend(trend)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load class analytics.")
      setRows([])
      setWeeklyTrend([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const overview = useMemo(() => computeClassAnalyticsOverview(rows), [rows])
  const engagementDistribution = useMemo(() => buildEngagementDistribution(rows), [rows])

  return {
    rows,
    overview,
    engagementDistribution,
    weeklyTrend,
    loading,
    error,
    reload: load,
    filterAndSort: (query: string, sort: ClassAnalyticsSort, section = "ALL") =>
      sortClassAnalyticsRows(filterClassAnalyticsRows(rows, query, section), sort),
  }
}
