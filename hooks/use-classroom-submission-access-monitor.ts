"use client"

import { useCallback, useRef, useState } from "react"
import {
  buildClassroomSubmissionsSnapshot,
  getClassroomAccessLockExplanation,
  isClassroomAssignmentSubmittable,
  resolveActiveAssignmentId,
  type ClassroomAccessNotice,
  type ClassroomSubmissionsSnapshot,
} from "@/lib/classroom-assignment-access"

type Channel = "code" | "solution"

export type ClassroomSelectionRefs = {
  codeActiveId: string
  codeMissingId: string
  solutionActiveId: string
  solutionMissingId: string
}

type SelectionSetters = {
  setCodeActiveId: (id: string) => void
  setCodeMissingId: (id: string) => void
  setCodePendingId: (id: string) => void
  setSolutionActiveId: (id: string) => void
  setSolutionMissingId: (id: string) => void
  setSolutionPendingId: (id: string) => void
}

type ToastFn = (props: {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}) => void

export function useClassroomSubmissionAccessMonitor(
  toast: ToastFn,
  getSelection: () => ClassroomSelectionRefs,
  setters: SelectionSetters,
) {
  const wasSubmittableRef = useRef<Partial<Record<Channel, number>>>({})
  const [codeNotice, setCodeNotice] = useState<ClassroomAccessNotice | null>(null)
  const [solutionNotice, setSolutionNotice] = useState<ClassroomAccessNotice | null>(null)

  const syncSubmittableRef = useCallback(
    (snapshot: ClassroomSubmissionsSnapshot) => {
      const selectionRefs = getSelection()
      for (const channel of ["code", "solution"] as const) {
        const id =
          channel === "code"
            ? resolveActiveAssignmentId(selectionRefs.codeActiveId, selectionRefs.codeMissingId)
            : resolveActiveAssignmentId(selectionRefs.solutionActiveId, selectionRefs.solutionMissingId)

        if (id != null && isClassroomAssignmentSubmittable(id, snapshot)) {
          wasSubmittableRef.current[channel] = id
        } else if (wasSubmittableRef.current[channel] === id) {
          delete wasSubmittableRef.current[channel]
        }
      }
    },
    [getSelection],
  )

  const handleSubmissionsRefresh = useCallback(
    (data: Parameters<typeof buildClassroomSubmissionsSnapshot>[0]) => {
      const snapshot = buildClassroomSubmissionsSnapshot(data)
      const selectionRefs = getSelection()

      const channels: Array<{
        channel: Channel
        activeId: string
        missingId: string
        setNotice: (n: ClassroomAccessNotice | null) => void
        clearActive: () => void
        setMissing: (id: string) => void
        setPending: (id: string) => void
        clearMissing: () => void
        clearPending: () => void
      }> = [
        {
          channel: "code",
          activeId: selectionRefs.codeActiveId,
          missingId: selectionRefs.codeMissingId,
          setNotice: setCodeNotice,
          clearActive: () => setters.setCodeActiveId(""),
          setMissing: setters.setCodeMissingId,
          setPending: setters.setCodePendingId,
          clearMissing: () => setters.setCodeMissingId(""),
          clearPending: () => setters.setCodePendingId(""),
        },
        {
          channel: "solution",
          activeId: selectionRefs.solutionActiveId,
          missingId: selectionRefs.solutionMissingId,
          setNotice: setSolutionNotice,
          clearActive: () => setters.setSolutionActiveId(""),
          setMissing: setters.setSolutionMissingId,
          setPending: setters.setSolutionPendingId,
          clearMissing: () => setters.setSolutionMissingId(""),
          clearPending: () => setters.setSolutionPendingId(""),
        },
      ]

      for (const {
        channel,
        activeId,
        missingId,
        setNotice,
        clearActive,
        setMissing,
        setPending,
        clearMissing,
        clearPending,
      } of channels) {
        const assignmentId = resolveActiveAssignmentId(activeId, missingId)
        if (assignmentId == null) continue

        const wasSubmittable = wasSubmittableRef.current[channel] === assignmentId
        const nowSubmittable = isClassroomAssignmentSubmittable(assignmentId, snapshot)

        if (wasSubmittable && !nowSubmittable) {
          const explanation = getClassroomAccessLockExplanation(assignmentId, snapshot, channel)
          if (explanation) {
            setNotice(explanation)
            toast({
              title: explanation.title,
              description: explanation.description,
              variant: explanation.reason === "pending_review" ? "default" : "destructive",
              duration: 12000,
            })
            if (activeId && activeId === String(assignmentId)) {
              clearActive()
              if (explanation.reason === "pending_review") {
                clearMissing()
                setPending(String(assignmentId))
              } else {
                clearPending()
                setMissing(String(assignmentId))
              }
            } else if (missingId && missingId === String(assignmentId) && explanation.reason === "pending_review") {
              clearMissing()
              setPending(String(assignmentId))
            }
          }
        } else if (nowSubmittable) {
          setNotice(null)
        }
      }

      syncSubmittableRef(snapshot)
      return snapshot
    },
    [getSelection, setters, syncSubmittableRef, toast],
  )

  const clearCodeNotice = useCallback(() => setCodeNotice(null), [])
  const clearSolutionNotice = useCallback(() => setSolutionNotice(null), [])

  const markChannelSubmittable = useCallback((channel: Channel, assignmentId: number) => {
    wasSubmittableRef.current[channel] = assignmentId
  }, [])

  return {
    codeNotice,
    solutionNotice,
    clearCodeNotice,
    clearSolutionNotice,
    markChannelSubmittable,
    handleSubmissionsRefresh,
  }
}
