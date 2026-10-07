"use client"

import { useCallback, useEffect, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { readCodebenchLiveClientId } from "@/lib/codebench-live-client"
import type { LiveEditorHeldBy } from "@/lib/codebench-live-handoff"
import { LIVE_STUDENT_SESSIONS_POLL_MS } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"
import { appendStudentCatalogScopeToUrl } from "@/lib/student-catalog-scope-client"

export type LiveEditorHoldNotice = LiveEditorHeldBy & {
  title: string
  yours: boolean
}

type State = {
  sessions: StudentLiveClassroomSession[]
  editorHold: LiveEditorHoldNotice | null
  savedAssignmentIds: number[]
  loading: boolean
  error: string | null
  /** False when the live-session list API is not deployed (404/405). */
  listSupported: boolean | null
}

export function useStudentLiveClassroomSessions(studentId: string | null) {
  const [state, setState] = useState<State>({
    sessions: [],
    editorHold: null,
    savedAssignmentIds: [],
    loading: Boolean(studentId),
    error: null,
    listSupported: null,
  })

  const reload = useCallback(async (silent = false) => {
    if (!studentId) {
      setState({ sessions: [], editorHold: null, savedAssignmentIds: [], loading: false, error: null, listSupported: null })
      return
    }
    if (!silent) setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const response = await studentApiFetch(
        appendStudentCatalogScopeToUrl(
          `/api/codebench/live-sessions?studentId=${encodeURIComponent(studentId)}&clientId=${encodeURIComponent(readCodebenchLiveClientId())}`,
        ),
      )
      if (response.status === 404 || response.status === 405) {
        setState({ sessions: [], editorHold: null, savedAssignmentIds: [], loading: false, error: null, listSupported: false })
        return
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(text || response.statusText)
      }
      const data = (await response.json()) as {
        sessions?: StudentLiveClassroomSession[]
        editorHold?: LiveEditorHoldNotice | null
        savedAssignmentIds?: number[]
      }
      const hold = data.editorHold
      const editorHold =
        hold && Number.isFinite(Number(hold.assignmentId))
          ? {
              assignmentId: Number(hold.assignmentId),
              clientId: typeof hold.clientId === "string" ? hold.clientId : null,
              clientLabel: typeof hold.clientLabel === "string" ? hold.clientLabel : "another device",
              title: typeof hold.title === "string" ? hold.title : "Live classroom",
              yours: hold.yours === true,
            }
          : null
      setState({
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        editorHold,
        savedAssignmentIds: Array.isArray(data.savedAssignmentIds)
          ? data.savedAssignmentIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
          : [],
        loading: false,
        error: null,
        listSupported: true,
      })
    } catch (error) {
      setState((current) => ({
        sessions: current.sessions,
        editorHold: current.editorHold,
        savedAssignmentIds: current.savedAssignmentIds,
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
