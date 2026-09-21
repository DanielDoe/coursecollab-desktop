"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import { LIVE_STUDENT_PUSH_POLL_MS } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"
import {
  knownLiveInstructorRevision,
  shouldApplyLiveInstructorPush,
  writeStoredLiveInstructorPush,
} from "@/lib/codebench-live-instructor-push-state"

type InstructorPushPayload = {
  revision?: number
  code?: string
  fileName?: string | null
}

export type InstructorPushApplyMeta = {
  revision: number
  fileName: string | null
  restore: boolean
}

export function useCodebenchLiveInstructorPush({
  studentId,
  assignmentId,
  enabled,
  onApply,
}: {
  studentId: string | null
  assignmentId: string | null
  enabled: boolean
  onApply: (code: string, meta: InstructorPushApplyMeta) => void
}) {
  const appliedRevisionRef = useRef(knownLiveInstructorRevision(studentId, assignmentId))
  const onApplyRef = useRef(onApply)
  const [ready, setReady] = useState(!enabled)
  onApplyRef.current = onApply

  useEffect(() => {
    setReady(!enabled)
    if (!enabled || !studentId || !assignmentId) return
    const revision = knownLiveInstructorRevision(studentId, assignmentId)
    appliedRevisionRef.current = Math.max(appliedRevisionRef.current, revision)
  }, [assignmentId, enabled, studentId])

  const pull = useCallback(async () => {
    if (!enabled || !studentId || !assignmentId) {
      setReady(true)
      return
    }
    try {
      const response = await studentApiFetch(
        `/api/codebench/live-push?studentId=${encodeURIComponent(studentId)}&assignmentId=${encodeURIComponent(assignmentId)}`,
      )
      if (!response.ok) {
        setReady(true)
        return
      }
      const data = (await response.json()) as InstructorPushPayload
      const revision = Number(data.revision) || 0
      const code = typeof data.code === "string" ? data.code : ""
      const baseline = knownLiveInstructorRevision(studentId, assignmentId)
      const apply = shouldApplyLiveInstructorPush({
        revision,
        baselineRevision: baseline,
        appliedRevision: appliedRevisionRef.current,
      })
      if (revision > appliedRevisionRef.current && code) {
        appliedRevisionRef.current = revision
        writeStoredLiveInstructorPush(studentId, assignmentId, {
          revision,
          code,
          fileName: data.fileName ?? null,
        })
        if (!apply) return
        onApplyRef.current(code, {
          revision,
          fileName: data.fileName ?? null,
          restore: false,
        })
      }
    } catch {
      /* best effort */
    } finally {
      setReady(true)
    }
  }, [assignmentId, enabled, studentId])

  useEffect(() => {
    void pull()
  }, [pull])

  useImmediateLivePoll(pull, LIVE_STUDENT_PUSH_POLL_MS, Boolean(enabled && studentId && assignmentId))

  return { ready }
}
