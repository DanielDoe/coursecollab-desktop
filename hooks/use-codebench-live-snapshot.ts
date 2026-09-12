"use client"

import { useCallback, useEffect, useRef } from "react"
import type { TypingReplay } from "@/lib/typing-replay"
import { studentApiFetch } from "@/lib/auth"
import { stripCodebenchProbeComments } from "@/lib/codebench-strip-probe-comments"
import {
  LIVE_STUDENT_SNAPSHOT_DEBOUNCE_MS,
  LIVE_STUDENT_SNAPSHOT_INITIAL_MS,
  LIVE_STUDENT_SNAPSHOT_INTERVAL_MS,
} from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"

const MAX_REPLAY_EVENTS = 800

type EditorLike = {
  getModel?: () => {
    onDidChangeContent: (cb: (e: { changes?: Array<{ rangeOffset?: number; rangeLength?: number; text?: string }> }) => void) => {
      dispose: () => void
    }
    getValue: () => string
  } | null
  getValue?: () => string
} | null

type Options = {
  studentId: string | null
  assignmentId: string | null
  code: string
  language: string
  fileName: string | null
  editorRef: EditorLike
  enabled: boolean
}

function readEditorCode(editorRef: EditorLike, fallback: string): string {
  const fromEditor = editorRef?.getValue?.() ?? editorRef?.getModel?.()?.getValue?.()
  return typeof fromEditor === "string" ? fromEditor : fallback
}

export function useCodebenchLiveSnapshot({
  studentId,
  assignmentId,
  code,
  language,
  fileName,
  editorRef,
  enabled,
}: Options) {
  const replayRef = useRef<TypingReplay>({ startTime: 0, events: [] })
  const lastPostRef = useRef(0)
  const lastPostedCodeRef = useRef<string | null>(null)
  const pendingRef = useRef(false)
  const codeRef = useRef(code)
  const editorRefStable = useRef(editorRef)
  const ignoreUntilRef = useRef(0)

  codeRef.current = code
  editorRefStable.current = editorRef

  useEffect(() => {
    replayRef.current = { startTime: 0, events: [] }
    lastPostedCodeRef.current = null
  }, [assignmentId])

  useEffect(() => {
    if (!enabled || !editorRef?.getModel) return
    const model = editorRef.getModel()
    if (!model) return

    replayRef.current = {
      startTime: Date.now(),
      initialDocument: model.getValue(),
      events: [],
    }

    const dispose = model.onDidChangeContent((e: { changes?: Array<{ rangeOffset?: number; rangeLength?: number; text?: string }> }) => {
      if (Date.now() < ignoreUntilRef.current) return
      const now = Date.now()
      if (replayRef.current.events.length === 0) {
        replayRef.current.startTime = now
      }
      const startTime = replayRef.current.startTime
      const changes = [...(e.changes || [])].reverse()
      for (const c of changes) {
        const offset = c.rangeOffset ?? 0
        const rangeLength = c.rangeLength ?? 0
        const text = c.text ?? ""
        if (rangeLength > 0 && text.length === 0) {
          replayRef.current.events.push({ t: now - startTime, op: "d", offset, text: "", len: rangeLength })
        } else if (text.length > 0) {
          if (rangeLength > 0) {
            replayRef.current.events.push({ t: now - startTime, op: "d", offset, text: "", len: rangeLength })
          }
          replayRef.current.events.push({ t: now - startTime, op: "i", offset, text })
        }
      }
      if (replayRef.current.events.length > MAX_REPLAY_EVENTS) {
        replayRef.current.events = replayRef.current.events.slice(-MAX_REPLAY_EVENTS)
      }
    })

    return () => dispose.dispose()
  }, [editorRef, enabled, assignmentId])

  /** Briefly ignore typing-replay capture after an instructor apply (does not block code snapshots). */
  const noteExternalApply = useCallback((ms = 400) => {
    ignoreUntilRef.current = Date.now() + ms
  }, [])

  const postSnapshot = useCallback(async (force = false) => {
    if (!enabled || !studentId || !assignmentId || pendingRef.current) return
    const latestCode = stripCodebenchProbeComments(
      readEditorCode(editorRefStable.current, codeRef.current),
    )
    if (!force && latestCode === lastPostedCodeRef.current) return
    pendingRef.current = true
    try {
      const response = await studentApiFetch("/api/codebench/live-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assignmentId: Number(assignmentId),
          code: latestCode,
          language,
          fileName,
          typingReplay: replayRef.current.events.length ? replayRef.current : undefined,
        }),
        keepalive: true,
      })
      if (response.ok) {
        lastPostRef.current = Date.now()
        lastPostedCodeRef.current = latestCode
      }
    } catch {
      /* best effort */
    } finally {
      pendingRef.current = false
    }
  }, [assignmentId, enabled, fileName, language, studentId])

  useImmediateLivePoll(
    () => {
      if (Date.now() - lastPostRef.current >= LIVE_STUDENT_SNAPSHOT_INTERVAL_MS) {
        void postSnapshot()
      }
    },
    LIVE_STUDENT_SNAPSHOT_INTERVAL_MS,
    Boolean(enabled && studentId && assignmentId),
  )

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const timer = window.setTimeout(() => void postSnapshot(true), LIVE_STUDENT_SNAPSHOT_INITIAL_MS)
    return () => window.clearTimeout(timer)
  }, [assignmentId, enabled, postSnapshot, studentId])

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const timer = window.setTimeout(() => {
      void postSnapshot()
    }, LIVE_STUDENT_SNAPSHOT_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [assignmentId, code, enabled, postSnapshot, studentId])

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const flush = () => {
      if (document.visibilityState === "hidden") void postSnapshot(true)
    }
    document.addEventListener("visibilitychange", flush)
    window.addEventListener("pagehide", flush)
    return () => {
      document.removeEventListener("visibilitychange", flush)
      window.removeEventListener("pagehide", flush)
    }
  }, [assignmentId, enabled, postSnapshot, studentId])

  return { noteExternalApply }
}
