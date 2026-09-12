"use client"

import { useCallback, useEffect, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { LIVE_STUDENT_SESSIONS_POLL_MS } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"

type State = {
  sessions: StudentLiveClassroomSession[]
  loading: boolean
  error: string | null
  /** False when the live-session list API is not deployed (404/405). */
  listSupported: boolean | null
}

export function useStudentLiveClassroomSessions(studentId: string | null) {
  const [state, setState] = useState<State>({
    sessions: [],
    loading: Boolean(studentId),
    error: null,
    listSupported: null,
  })

  const reload = useCallback(async (silent = false) => {
    if (!studentId) {
      setState({ sessions: [], loading: false, error: null, listSupported: null })
      return
    }
    if (!silent) setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const response = await studentApiFetch(
        `/api/codebench/live-sessions?studentId=${encodeURIComponent(studentId)}`,
      )
      if (response.status === 404 || response.status === 405) {
        setState({ sessions: [], loading: false, error: null, listSupported: false })
        return
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(text || response.statusText)
      }
      const data = (await response.json()) as { sessions?: StudentLiveClassroomSession[] }
      setState({
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        loading: false,
        error: null,
        listSupported: true,
      })
    } catch (error) {
      setState((current) => ({
        sessions: silent ? current.sessions : [],
        loading: false,
        listSupported: current.listSupported,
        error: error instanceof Error ? error.message : "Failed to load live sessions",
      }))
    }
  }, [studentId])

  useEffect(() => {
    void reload()
  }, [reload])

  useImmediateLivePoll(() => void reload(true), LIVE_STUDENT_SESSIONS_POLL_MS, Boolean(studentId))

  return { ...state, reload }
}
