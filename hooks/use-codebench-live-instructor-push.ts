"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import { LIVE_STUDENT_PUSH_POLL_MS, liveStudentPushKey } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"

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

function readStoredPush(studentId: string, assignmentId: string): InstructorPushPayload | null {
  try {
    const raw = sessionStorage.getItem(liveStudentPushKey(studentId, assignmentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as InstructorPushPayload
    if (typeof parsed.code !== "string" || !parsed.code) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredPush(studentId: string, assignmentId: string, payload: InstructorPushPayload) {
  try {
    sessionStorage.setItem(liveStudentPushKey(studentId, assignmentId), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
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
  const appliedRevisionRef = useRef(0)
  const hasAppliedRef = useRef(false)
  const onApplyRef = useRef(onApply)
  const [ready, setReady] = useState(!enabled)
  onApplyRef.current = onApply

  useEffect(() => {
    appliedRevisionRef.current = 0
    hasAppliedRef.current = false
    setReady(!enabled)
    if (!enabled || !studentId || !assignmentId) return
    const stored = readStoredPush(studentId, assignmentId)
    if (!stored?.code) return
    const revision = Number(stored.revision) || 0
    appliedRevisionRef.current = revision
    hasAppliedRef.current = true
    // Mark revision as applied so we don't re-push on first poll; only restore editor if empty-ish later via onApply when needed.
    // Re-applying on every mount fights the student stream — only restore when the editor is blank.
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
      if (revision > appliedRevisionRef.current && code) {
        const restore = !hasAppliedRef.current
        hasAppliedRef.current = true
        appliedRevisionRef.current = revision
        writeStoredPush(studentId, assignmentId, {
          revision,
          code,
          fileName: data.fileName ?? null,
        })
        onApplyRef.current(code, {
          revision,
          fileName: data.fileName ?? null,
          restore,
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
