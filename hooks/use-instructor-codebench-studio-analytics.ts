"use client"

import { useCallback, useEffect, useState } from "react"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"

export type InstructorStudioAnalytics = {
  windowDays: number
  runs: number
  compilesOk: number
  compilesFail: number
  successRate: number
  activeStudents: number
  submissions: number
  avgScore: number | null
  families: Array<{ family: string; label: string; tip: string; count: number }>
  tools: Array<{ tool: string; count: number }>
  students: Array<{ id: number; name: string; code: string | null; errors: number; successes: number; runs: number }>
  teachingMove: string
}

export const EMPTY_INSTRUCTOR_STUDIO_ANALYTICS: InstructorStudioAnalytics = {
  windowDays: 30,
  runs: 0,
  compilesOk: 0,
  compilesFail: 0,
  successRate: 0,
  activeStudents: 0,
  submissions: 0,
  avgScore: null,
  families: [],
  tools: [],
  students: [],
  teachingMove:
    "Students have not generated studio compile data yet. Once they run code in CodeBench, activity and fault patterns appear here.",
}

function normalizePayload(raw: unknown): InstructorStudioAnalytics {
  if (!raw || typeof raw !== "object") return EMPTY_INSTRUCTOR_STUDIO_ANALYTICS
  const row = raw as Record<string, unknown>
  return {
    windowDays: Number(row.windowDays) || 30,
    runs: Number(row.runs) || 0,
    compilesOk: Number(row.compilesOk) || 0,
    compilesFail: Number(row.compilesFail) || 0,
    successRate: Number(row.successRate) || 0,
    activeStudents: Number(row.activeStudents) || 0,
    submissions: Number(row.submissions) || 0,
    avgScore: row.avgScore != null ? Number(row.avgScore) : null,
    families: Array.isArray(row.families)
      ? row.families.map((entry) => {
          const item = entry as Record<string, unknown>
          return {
            family: String(item.family ?? "other"),
            label: String(item.label ?? "Other"),
            tip: String(item.tip ?? ""),
            count: Number(item.count) || 0,
          }
        })
      : [],
    tools: Array.isArray(row.tools)
      ? row.tools.map((entry) => {
          const item = entry as Record<string, unknown>
          return { tool: String(item.tool ?? "unknown"), count: Number(item.count) || 0 }
        })
      : [],
    students: Array.isArray(row.students)
      ? row.students.map((entry) => {
          const item = entry as Record<string, unknown>
          return {
            id: Number(item.id) || 0,
            name: String(item.name ?? "Student"),
            code: item.code ? String(item.code) : null,
            errors: Number(item.errors) || 0,
            successes: Number(item.successes) || 0,
            runs: Number(item.runs) || 0,
          }
        })
      : [],
    teachingMove:
      typeof row.teachingMove === "string" && row.teachingMove.trim()
        ? row.teachingMove
        : EMPTY_INSTRUCTOR_STUDIO_ANALYTICS.teachingMove,
  }
}

export function useInstructorCodebenchStudioAnalytics() {
  const [data, setData] = useState<InstructorStudioAnalytics>(EMPTY_INSTRUCTOR_STUDIO_ANALYTICS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await instructorApiFetch("/api/instructor/codebench/studio-analytics")
      const parsed = await readInstructorApiJson<InstructorStudioAnalytics>(
        res,
        "CodeBench studio analytics",
      )

      if (!parsed.ok) {
        setError(parsed.error)
        setData(EMPTY_INSTRUCTOR_STUDIO_ANALYTICS)
        return
      }

      setData(normalizePayload(parsed.data))
    } catch {
      setError("Could not reach studio analytics. Check your connection and try again.")
      setData(EMPTY_INSTRUCTOR_STUDIO_ANALYTICS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
