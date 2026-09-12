"use client"

import { useCallback, useEffect, useState } from "react"
import { classroomAssignmentIsOpen } from "@/lib/classroom-submission-availability"
import { defaultFacultySessionFilter } from "@/hooks/use-instructor-scope-key"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { ClassroomAssignmentRow } from "@/lib/codebench-instructor-classroom"

type State = {
  submissions: ClassroomAssignmentRow[]
  loading: boolean
  error: string | null
}

export function useInstructorClassroomAssignments(sessionFilter?: string | "all") {
  const [state, setState] = useState<State>({
    submissions: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const resolvedFilter = sessionFilter ?? defaultFacultySessionFilter()
      const params = new URLSearchParams({ manage: "1" })
      if (resolvedFilter !== "all") params.set("session", resolvedFilter)
      const response = await instructorApiFetch(`/api/classroom-points/submissions?${params}`, {
        headers: buildInstructorAuthorizedApiHeaders(),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        setState({ submissions: [], loading: false, error: text || response.statusText })
        return
      }
      const data = (await response.json()) as { submissions?: ClassroomAssignmentRow[] }
      const rows = Array.isArray(data.submissions) ? data.submissions : []
      setState({
        submissions: rows.map((row) => ({
          ...row,
          is_active: classroomAssignmentIsOpen(row),
        })),
        loading: false,
        error: null,
      })
    } catch (error) {
      setState({
        submissions: [],
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load classroom assignments",
      })
    }
  }, [sessionFilter])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ...state, reload }
}
