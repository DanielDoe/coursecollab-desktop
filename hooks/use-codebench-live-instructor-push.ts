"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import { LIVE_STUDENT_PUSH_POLL_MS } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"
import {
  joinBaselineForInstructorPush,
  knownLiveInstructorRevision,
  readStoredLiveInstructorPush,
  seedLiveInstructorPushBaseline,
  shouldApplyLiveInstructorPush,
  writeStoredLiveInstructorPush,
} from "@/lib/codebench-live-instructor-push-state"

type InstructorPushPayload = {
  revision?: number
  code?: string
  fileName?: string | null
  pushedAt?: string | null
  syncRequestedAt?: string | null
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
  onSyncRequest,
}: {
  studentId: string | null
  assignmentId: string | null
  enabled: boolean
  onApply: (code: string, meta: InstructorPushApplyMeta) => void | boolean
  onSyncRequest?: (requestedAt: string) => void
}) {
  const appliedRevisionRef = useRef(knownLiveInstructorRevision(studentId, assignmentId))
  const onApplyRef = useRef(onApply)
  const onSyncRequestRef = useRef(onSyncRequest)
  const handledSyncAtRef = useRef<string | null>(null)
  const [ready, setReady] = useState(!enabled)
  onApplyRef.current = onApply
  onSyncRequestRef.current = onSyncRequest

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
      const syncRequestedAt = typeof data.syncRequestedAt === "string" ? data.syncRequestedAt : ""
      if (syncRequestedAt && syncRequestedAt !== handledSyncAtRef.current) {
        handledSyncAtRef.current = syncRequestedAt
        onSyncRequestRef.current?.(syncRequestedAt)
      }
      const revision = Number(data.revision) || 0
      const code = typeof data.code === "string" ? data.code : ""
      const pushedAt = typeof data.pushedAt === "string" ? data.pushedAt : null
      if (!readStoredLiveInstructorPush(studentId, assignmentId)) {
        // An old push must not overwrite typed work. A push that just arrived
        // stays eligible, including the first poll after the student rejoins.
        const baseline = joinBaselineForInstructorPush({ serverRevision: revision, pushedAt })
        appliedRevisionRef.current = Math.max(
          appliedRevisionRef.current,
          seedLiveInstructorPushBaseline(studentId, assignmentId, baseline, { allowLower: true }),
        )
        if (baseline >= revision) return
      }
      const baseline = knownLiveInstructorRevision(studentId, assignmentId)
      const apply = shouldApplyLiveInstructorPush({
        revision,
        baselineRevision: baseline,
        appliedRevision: appliedRevisionRef.current,
      })
      if (revision > appliedRevisionRef.current && code && apply) {
        const accepted = onApplyRef.current(code, {
          revision,
          fileName: data.fileName ?? null,
          restore: false,
        }) !== false
        if (!accepted) return
        appliedRevisionRef.current = revision
        writeStoredLiveInstructorPush(studentId, assignmentId, {
          revision,
          code,
          fileName: data.fileName ?? null,
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
