"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TypingReplay } from "@/lib/typing-replay"
import { MAX_LIVE_REPLAY_EVENTS, trimTypingReplay } from "@/lib/typing-replay"
import { replayReconstructsTo, selectFaithfulTypingReplay } from "@/lib/codebench-live-replay"
import { studentApiFetch } from "@/lib/auth"
import { stripCodebenchProbeComments } from "@/lib/codebench-strip-probe-comments"
import {
  LIVE_STUDENT_SNAPSHOT_DEBOUNCE_MS,
  LIVE_STUDENT_SNAPSHOT_FAST_MS,
  LIVE_STUDENT_SNAPSHOT_INITIAL_MS,
  LIVE_STUDENT_SNAPSHOT_INTERVAL_MS,
  LIVE_STUDENT_SNAPSHOT_REPLAY_MS,
} from "@/lib/codebench-live-timing"
import { seedLiveInstructorPushBaseline } from "@/lib/codebench-live-instructor-push-state"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"

type EditorLike = {
  getModel?: () => {
    onDidChangeContent: (cb: (e: { changes?: Array<{ rangeOffset?: number; rangeLength?: number; text?: string }> }) => void) => {
      dispose: () => void
    }
    getValue: () => string
  } | null
  getValue?: () => string
  getPosition?: () => { lineNumber: number; column: number } | null
} | null

type Options = {
  studentId: string | null
  assignmentId: string | null
  code: string
  language: string
  fileName: string | null
  editorRef: EditorLike
  enabled: boolean
  onRestore?: (code: string) => void
}

function readEditorCode(editorRef: EditorLike, fallback: string): string {
  const fromEditor = editorRef?.getValue?.() ?? editorRef?.getModel?.()?.getValue?.()
  return typeof fromEditor === "string" ? fromEditor : fallback
}

function readEditorCursor(editorRef: EditorLike): { line: number; column: number } | null {
  try {
    const pos = editorRef?.getPosition?.()
    if (!pos || typeof pos.lineNumber !== "number") return null
    return {
      line: Math.max(1, Math.trunc(pos.lineNumber)),
      column: Math.max(1, Math.trunc(pos.column ?? 1)),
    }
  } catch {
    return null
  }
}

export function useCodebenchLiveSnapshot({
  studentId,
  assignmentId,
  code,
  language,
  fileName,
  editorRef,
  enabled,
  onRestore,
}: Options) {
  const replayRef = useRef<TypingReplay>({ startTime: 0, events: [] })
  const lastPostRef = useRef(0)
  const lastReplayPostRef = useRef(0)
  const lastPostedCodeRef = useRef<string | null>(null)
  const pendingRef = useRef(false)
  const needsRetryRef = useRef(false)
  const fastTimerRef = useRef<number | null>(null)
  const codeRef = useRef(code)
  const editorRefStable = useRef(editorRef)
  const ignoreUntilRef = useRef(0)
  const [restoreReady, setRestoreReady] = useState(!enabled)
  const onRestoreRef = useRef(onRestore)
  const restoreDoneRef = useRef(!enabled)
  const restoredForKeyRef = useRef<string | null>(null)
  onRestoreRef.current = onRestore

  codeRef.current = code
  editorRefStable.current = editorRef

  useEffect(() => {
    replayRef.current = { startTime: 0, events: [] }
    lastPostedCodeRef.current = null
    lastReplayPostRef.current = 0
  }, [assignmentId])

  const postSnapshotRef = useRef<
    (force?: boolean, includeReplay?: boolean) => Promise<void>
  >(async () => {})

  postSnapshotRef.current = async (force = false, includeReplay = false) => {
    if (!enabled || !studentId || !assignmentId) return
    if (!restoreDoneRef.current) {
      needsRetryRef.current = true
      return
    }
    if (pendingRef.current) {
      needsRetryRef.current = true
      return
    }
    const latestCode = stripCodebenchProbeComments(
      readEditorCode(editorRefStable.current, codeRef.current),
    )
    const unchanged = latestCode === lastPostedCodeRef.current
    if (!force && unchanged) return
    if (!force && !latestCode.trim()) return

    const now = Date.now()
    const replayToSend = trimTypingReplay(replayRef.current, MAX_LIVE_REPLAY_EVENTS)
    const sendReplay =
      includeReplay &&
      replayToSend.events.length > 0 &&
      now - lastReplayPostRef.current >= LIVE_STUDENT_SNAPSHOT_REPLAY_MS &&
      replayReconstructsTo(replayToSend, latestCode)

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
          studentCursor: readEditorCursor(editorRefStable.current),
          typingReplay: sendReplay ? replayToSend : undefined,
          intent: unchanged && !sendReplay ? "presence" : "code",
        }),
        keepalive: true,
      })
      if (response.ok) {
        lastPostRef.current = Date.now()
        lastPostedCodeRef.current = latestCode
        if (sendReplay) lastReplayPostRef.current = Date.now()
      } else if (process.env.NODE_ENV === "development") {
        const detail = await response.text().catch(() => "")
        console.warn("[codebench live-snapshot]", response.status, detail.slice(0, 200))
      }
    } catch {
      /* best effort */
    } finally {
      pendingRef.current = false
      if (needsRetryRef.current) {
        needsRetryRef.current = false
        void postSnapshotRef.current(true, false)
      }
    }
  }

  const scheduleFastPost = useCallback(() => {
    if (!enabled || !studentId || !assignmentId) return
    if (fastTimerRef.current != null) return
    fastTimerRef.current = window.setTimeout(() => {
      fastTimerRef.current = null
      void postSnapshotRef.current(false, false)
    }, LIVE_STUDENT_SNAPSHOT_FAST_MS)
  }, [assignmentId, enabled, studentId])

  useEffect(() => {
    if (!enabled || !editorRef?.getModel) return
    const model = editorRef.getModel()
    if (!model) return

    if (replayRef.current.events.length === 0) {
      replayRef.current = {
        startTime: Date.now(),
        initialDocument: model.getValue(),
        events: [],
      }
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
      if (replayRef.current.events.length > MAX_LIVE_REPLAY_EVENTS) {
        replayRef.current = trimTypingReplay(replayRef.current, MAX_LIVE_REPLAY_EVENTS)
      }
      scheduleFastPost()
    })

    return () => {
      dispose.dispose()
      if (fastTimerRef.current != null) {
        window.clearTimeout(fastTimerRef.current)
        fastTimerRef.current = null
      }
    }
  }, [editorRef, enabled, assignmentId, scheduleFastPost])

  const noteExternalApply = useCallback((ms = 400, nextDocument?: string) => {
    ignoreUntilRef.current = Date.now() + ms
    if (typeof nextDocument === "string") {
      replayRef.current = {
        startTime: Date.now(),
        initialDocument: nextDocument,
        events: [],
      }
    }
  }, [])

  useEffect(() => {
    restoredForKeyRef.current = null
  }, [assignmentId, studentId])

  useEffect(() => {
    if (!studentId || !assignmentId) {
      restoreDoneRef.current = true
      setRestoreReady(true)
      return
    }
    if (!enabled) {
      restoreDoneRef.current = true
      setRestoreReady(true)
      return
    }
    const key = `${studentId}:${assignmentId}`
    if (restoredForKeyRef.current === key) {
      restoreDoneRef.current = true
      setRestoreReady(true)
      return
    }
    let cancelled = false
    restoreDoneRef.current = false
    setRestoreReady(false)
    void (async () => {
      try {
        const response = await studentApiFetch(
          `/api/codebench/live-snapshot?studentId=${encodeURIComponent(studentId)}&assignmentId=${encodeURIComponent(assignmentId)}`,
        )
        if (!response.ok || cancelled) return
        const data = (await response.json()) as {
          code?: string
          instructorRevision?: number
          typingReplay?: TypingReplay | null
        }
        seedLiveInstructorPushBaseline(studentId, assignmentId, Number(data.instructorRevision) || 0)
        const saved = typeof data.code === "string" ? data.code : ""
        if (saved.trim()) onRestoreRef.current?.(saved)
        const restoredReplay = selectFaithfulTypingReplay(data.typingReplay, saved)
        if (restoredReplay) replayRef.current = trimTypingReplay(restoredReplay)
        if (!cancelled) restoredForKeyRef.current = key
      } catch {
        /* keep the local editor */
      } finally {
        if (!cancelled) {
          restoreDoneRef.current = true
          setRestoreReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assignmentId, enabled, studentId])

  useImmediateLivePoll(
    () => {
      const includeReplay = Date.now() - lastReplayPostRef.current >= LIVE_STUDENT_SNAPSHOT_REPLAY_MS
      void postSnapshotRef.current(true, includeReplay)
    },
    LIVE_STUDENT_SNAPSHOT_INTERVAL_MS,
    Boolean(enabled && studentId && assignmentId),
  )

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const timer = window.setTimeout(() => void postSnapshotRef.current(true, true), LIVE_STUDENT_SNAPSHOT_INITIAL_MS)
    return () => window.clearTimeout(timer)
  }, [assignmentId, enabled, studentId])

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const timer = window.setTimeout(() => {
      void postSnapshotRef.current(false, false)
    }, LIVE_STUDENT_SNAPSHOT_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [assignmentId, code, enabled, studentId])

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const flush = () => {
      if (document.visibilityState === "hidden") void postSnapshotRef.current(true, true)
    }
    document.addEventListener("visibilitychange", flush)
    window.addEventListener("pagehide", flush)
    return () => {
      document.removeEventListener("visibilitychange", flush)
      // BUGFIX: this previously ADDED another pagehide listener on cleanup, leaking handlers
      // on every assignmentId/enabled change.
      window.removeEventListener("pagehide", flush)
      // Flush the last buffer on teardown (navigation/session switch) so trailing keystrokes
      // aren't lost with the cancelled debounce. The effect only registers while enabled.
      void postSnapshotRef.current(true, false)
    }
  }, [assignmentId, enabled, studentId])

  return { noteExternalApply, restoreReady }
}
