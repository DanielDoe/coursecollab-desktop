"use client"

import { useCallback, useEffect, useState } from "react"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import type { OpenLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"
import { LIVE_INSTRUCTOR_SESSIONS_POLL_MS } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"

type State = {
  sessions: OpenLiveClassroomSession[]
  loading: boolean
  error: string | null
}

export function useInstructorLiveClassroomSessions() {
  const scopeKey = useInstructorScopeKey()
  const [state, setState] = useState<State>({
    sessions: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async (silent = false) => {
    if (!silent) setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const response = await instructorApiFetch("/api/instructor/codebench/live-session")
      if (response.status === 400 || response.status === 404 || response.status === 405) {
        setState({ sessions: [], loading: false, error: null })
        return
      }
      const parsed = await readInstructorApiJson<{ sessions?: OpenLiveClassroomSession[] }>(
        response,
        "Open live sessions",
      )
      if (!parsed.ok) throw new Error(parsed.error)
      setState({
        sessions: Array.isArray(parsed.data.sessions) ? parsed.data.sessions : [],
        loading: false,
        error: null,
      })
    } catch (error) {
      setState((current) => ({
        sessions: silent ? current.sessions : [],
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load live sessions",
      }))
    }
  }, [scopeKey])

  useEffect(() => {
    void reload()
  }, [reload])

  useImmediateLivePoll(() => void reload(true), LIVE_INSTRUCTOR_SESSIONS_POLL_MS)

  return { ...state, reload }
}
