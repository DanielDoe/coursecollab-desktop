"use client"

import { useCallback, useEffect, useState } from "react"
import {
  runInstructorBulkReevaluateTabBatch,
  runInstructorBulkReevaluateAttempt,
} from "@/lib/instructor-bulk-reevaluate-client"
import type { BulkReevalMode } from "@/lib/instructor-bulk-reevaluate-client"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

/** One request per question (chunked) vs one request per attempt (batch). */
export type BulkReevaluateStrategy = "chunked" | "batch"
export type AssessmentBulkReevaluateScope = "pending" | "all"

export type AttemptRowStatus = "idle" | "running" | "done" | "error"

export interface BulkReevaluateAttemptRow {
  id: number
  /** From roster / students.full_name when available */
  studentName?: string
  status: AttemptRowStatus
  error?: string
  newScore?: number
  evaluated?: number
}

export function instructorBulkHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  return buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })
}

export function useBulkReevaluateAttempts(
  quizId: number | null,
  scope: AssessmentBulkReevaluateScope,
  /** When set, preview only includes attempts for students in this class session (matches tab filter). */
  sessionCode?: string | null
) {
  const [loadingList, setLoadingList] = useState(false)
  const [rows, setRows] = useState<BulkReevaluateAttemptRow[]>([])
  const [phase, setPhase] = useState<"pick" | "ready" | "running">("pick")
  const [running, setRunning] = useState(false)
  /** True after a run: pending queue is stale until instructor clicks Preview. */
  const [staleCandidateList, setStaleCandidateList] = useState(false)

  const reset = useCallback(() => {
    setRows([])
    setPhase("pick")
    setRunning(false)
    setStaleCandidateList(false)
  }, [])

  useEffect(() => {
    reset()
  }, [quizId, scope, sessionCode, reset])

  const loadCandidates = useCallback(async () => {
    if (!quizId) return
    setStaleCandidateList(false)
    setLoadingList(true)
    setRows([])
    setPhase("pick")
    try {
      const q = scope === "pending" ? "pending" : "all"
      const params = new URLSearchParams({ scope: q })
      const code = sessionCode?.trim()
      if (code) params.set("sessionCode", code)
      const res = await instructorApiFetch(`/api/instructor/assessments/${quizId}/reevaluate-candidates?${params.toString()}`, {
        headers: instructorBulkHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load attempts")
      const attempts = data.attempts as { id: number; studentName: string }[] | undefined
      const ids = (data.attemptIds as number[]) || []
      if (attempts?.length) {
        setRows(
          attempts.map((a) => ({
            id: a.id,
            studentName: a.studentName || undefined,
            status: "idle" as AttemptRowStatus,
          }))
        )
      } else {
        setRows(ids.map((id) => ({ id, status: "idle" as AttemptRowStatus })))
      }
      setPhase("ready")
    } catch (e) {
      console.error(e)
      setPhase("pick")
    } finally {
      setLoadingList(false)
    }
  }, [quizId, scope, sessionCode])

  const runAll = useCallback(
    async (strategy: BulkReevaluateStrategy = "batch") => {
      if (!quizId || rows.length === 0) return
      setStaleCandidateList(false)
      // Must use "all" for both scopes: preview "pending" uses PND% (requires_review, code+0pts, etc.),
      // but API mode "failed" only re-grades a subset of answers—so PND often never clears and lists don't shrink.
      const mode: BulkReevalMode = "all"
      setRunning(true)
      setPhase("running")
      const headers = instructorBulkHeaders()
      /** Chunked: many HTTP calls per attempt — space out to reduce dev-server memory pressure. */
      const delayMs = strategy === "chunked" ? 750 : 750
      const list = rows

      for (let i = 0; i < list.length; i++) {
        const id = list[i].id
        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: "running" as AttemptRowStatus } : r)))

        try {
          const last =
            strategy === "batch"
              ? await runInstructorBulkReevaluateTabBatch(id, mode, headers)
              : (await runInstructorBulkReevaluateAttempt(id, mode, headers)).last
          const newScore = typeof last.newAttemptScore === "number" ? last.newAttemptScore : undefined
          const evaluated = typeof last.evaluated === "number" ? last.evaluated : undefined
          setRows((prev) =>
            prev.map((r, j) =>
              j === i ? { ...r, status: "done" as AttemptRowStatus, newScore, evaluated } : r
            )
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          setRows((prev) =>
            prev.map((r, j) => (j === i ? { ...r, status: "error" as AttemptRowStatus, error: msg } : r))
          )
        }

        if (i < list.length - 1 && delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs))
        }
      }

      setRunning(false)
      setPhase("ready")
      // Do not call loadCandidates() here: it clears rows and resets every line to "Waiting", which looks like the run failed.
      // Instructors can click "Preview attempt list" to refresh who still qualifies (e.g. pending PND%).
      setStaleCandidateList(true)
    },
    [quizId, rows]
  )

  return {
    loadingList,
    rows,
    phase,
    running,
    loadCandidates,
    runAll,
    reset,
    staleCandidateList,
  }
}
