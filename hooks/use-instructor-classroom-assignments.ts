"use client"

import { useCallback, useEffect, useState } from "react"
import { classroomAssignmentAvailableForInstructorManage } from "@/lib/classroom-submission-availability"
import { defaultFacultySessionFilter } from "@/hooks/use-instructor-scope-key"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { ClassroomAssignmentRow } from "@/lib/codebench-instructor-classroom"

type State = {
  submissions: ClassroomAssignmentRow[]
  loading: boolean
  error: string | null
}

const cache = new Map<string, ClassroomAssignmentRow[]>()

export function invalidateInstructorClassroomAssignmentsCache() {
  cache.clear()
}

function cacheKey(sessionFilter: string | "all") {
  return sessionFilter
}

export function useInstructorClassroomAssignments(sessionFilter?: string | "all") {
  const resolvedFilter = sessionFilter ?? defaultFacultySessionFilter()
  const key = cacheKey(resolvedFilter)
  const cached = cache.get(key)

  const [state, setState] = useState<State>({
    submissions: cached ?? [],
    loading: !cached,
    error: null,
  })

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      if (!silent) {
        setState((current) => ({
          ...current,
          loading: current.submissions.length === 0,
          error: null,
        }))
      }
      try {
        const params = new URLSearchParams({ manage: "1" })
        if (resolvedFilter !== "all") params.set("session", resolvedFilter)
        const response = await instructorApiFetch(`/api/classroom-points/submissions?${params}`, {
          headers: buildInstructorAuthorizedApiHeaders(),
        })
        if (!response.ok) {
          const text = await response.text().catch(() => "")
          setState((current) => ({
            submissions: silent ? current.submissions : [],
            loading: false,
            error: text || response.statusText,
          }))
          return
        }
        const data = (await response.json()) as { submissions?: ClassroomAssignmentRow[] }
        const rows = Array.isArray(data.submissions) ? data.submissions : []
        const normalized = rows.map((row) => ({
          ...row,
          is_active: classroomAssignmentAvailableForInstructorManage(row),
        }))
        cache.set(key, normalized)
        setState({
          submissions: normalized,
          loading: false,
          error: null,
        })
      } catch (error) {
        setState((current) => ({
          submissions: silent ? current.submissions : [],
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load classroom assignments",
        }))
      }
    },
    [key, resolvedFilter],
  )

  useEffect(() => {
    void reload({ silent: cache.has(key) })
  }, [key, reload])

  return { ...state, reload: () => reload() }
}
