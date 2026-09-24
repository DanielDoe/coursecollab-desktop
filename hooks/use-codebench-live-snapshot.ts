"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TypingReplay } from "@/lib/typing-replay"
import { MAX_LIVE_REPLAY_EVENTS, trimTypingReplay } from "@/lib/typing-replay"
import {
  replayReconstructsTo,
  selectFaithfulTypingReplay,
  shiftTypingReplayClock,
} from "@/lib/codebench-live-replay"
import { studentApiFetch } from "@/lib/auth"
import { codebenchLiveCodeToPersist, isCodebenchBoilerplate, normalizeCodebenchLanguageId } from "@/lib/codebench-languages"
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
import { setStudioLiveAssignment } from "@/lib/codebench-studio-analytics"
import { readRememberedLiveJoin } from "@/lib/codebench-live-join-memory"

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

/** Whether the classroom has actually accepted this editor. Drives ON AIR. */
export type LiveEditorConnection =
  | { state: "idle" }
  | { state: "connecting" }
  | { state: "live" }
  | { state: "rejected"; httpStatus: number; message: string }
  | { state: "ended" }

export const LIVE_EDITOR_CONNECTION_EVENT = "codebench-live-connection"

export type LiveEditorConnectionEventDetail = {
  assignmentId: string
  connection: LiveEditorConnection
}

/** Consecutive 410s before the student is told the session ended. */
const LIVE_SESSION_GONE_CONFIRM = 2

type LiveSignalResult = { status: number | null; error: string | null }

async function readLiveError(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { error?: unknown }
    return typeof data?.error === "string" ? data.error : null
  } catch {
    return null
  }
}

function sendLiveEditorSignal(
  studentId: string,
  assignmentId: string,
  intent: "join" | "leave",
): Promise<LiveSignalResult> {
  return studentApiFetch("/api/codebench/live-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId,
      assignmentId: Number(assignmentId),
      intent,
    }),
    keepalive: true,
  })
    .then(async (response) => ({
      status: response.status,
      error: response.ok ? null : await readLiveError(response),
    }))
    .catch(() => ({ status: null, error: null }))
}

export function sendLiveEditorLeave(studentId: string, assignmentId: string): Promise<void> {
  return sendLiveEditorSignal(studentId, assignmentId, "leave").then(() => undefined)
}

/**
 * Refresh keeps the join in sessionStorage and remounts the editor. Do not leave
 * in that case — the instructor would flash "Not started" and the student would
 * rejoin a moment later. A real close still drops them after the 10s heartbeat.
 */
function shouldKeepJoinAcrossUnload(studentId: string, assignmentId: string): boolean {
  return readRememberedLiveJoin(studentId) === String(assignmentId)
}

// keepalive fetch, not sendBeacon: student auth rides on headers a beacon cannot send.
function sendLiveEditorLeaveOnUnload(studentId: string, assignmentId: string): void {
  if (shouldKeepJoinAcrossUnload(studentId, assignmentId)) return
  void sendLiveEditorLeave(studentId, assignmentId)
}

/** Persist the open editor when the student is not in the live room. Does not join. */
export function saveLiveEditorCode(input: {
  studentId: string
  assignmentId: string
  code: string
  language: string
  fileName: string | null
}): Promise<void> {
  return studentApiFetch("/api/codebench/live-snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: input.studentId,
      assignmentId: Number(input.assignmentId),
      code: input.code,
      language: input.language,
      fileName: input.fileName,
      intent: "code",
      keepJoined: false,
    }),
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined)
}

function sendLiveEditorJoin(studentId: string, assignmentId: string): Promise<LiveSignalResult> {
  return sendLiveEditorSignal(studentId, assignmentId, "join")
}

function replayMarkOf(replay: TypingReplay): string {
  const last = replay.events[replay.events.length - 1]
  return `${replay.startTime}:${replay.events.length}:${last?.t ?? ""}`
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
  const lastReplayMarkRef = useRef<string | null>(null)
  const lastPostedCodeRef = useRef<string | null>(null)
  const protectedCodeRef = useRef<string | null>(null)
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
  const editorPresenceRef = useRef(0)
  const unloadingRef = useRef(false)
  onRestoreRef.current = onRestore

  codeRef.current = code
  editorRefStable.current = editorRef

  useEffect(() => {
    replayRef.current = { startTime: 0, events: [] }
    lastPostedCodeRef.current = null
    lastReplayPostRef.current = 0
    lastReplayMarkRef.current = null
  }, [assignmentId])

  const sharingRef = useRef(enabled)
  sharingRef.current = enabled

  const [connection, setConnection] = useState<LiveEditorConnection>({ state: "idle" })
  const goneCountRef = useRef(0)
  const noteServerAccepted = useCallback(() => {
    goneCountRef.current = 0
    setConnection((current) => (current.state === "live" ? current : { state: "live" }))
  }, [])
  const noteServerRejected = useCallback((httpStatus: number, message: string | null) => {
    if (httpStatus === 410) {
      goneCountRef.current += 1
      if (goneCountRef.current >= LIVE_SESSION_GONE_CONFIRM) setConnection({ state: "ended" })
      return
    }
    if (httpStatus === 403 || httpStatus === 404) {
      setConnection({
        state: "rejected",
        httpStatus,
        message: message ?? "The live classroom did not accept this editor.",
      })
    }
    // 5xx and network errors keep the current state; the heartbeat retries.
  }, [])

  useEffect(() => {
    goneCountRef.current = 0
    setConnection(enabled && studentId && assignmentId ? { state: "connecting" } : { state: "idle" })
  }, [assignmentId, enabled, studentId])

  useEffect(() => {
    setStudioLiveAssignment(connection.state === "live" ? assignmentId : null)
    if (!assignmentId) return
    window.dispatchEvent(
      new CustomEvent<LiveEditorConnectionEventDetail>(LIVE_EDITOR_CONNECTION_EVENT, {
        detail: { assignmentId, connection },
      }),
    )
  }, [assignmentId, connection])

  useEffect(() => () => setStudioLiveAssignment(null), [])

  const postSnapshotRef = useRef<
    (force?: boolean, includeReplay?: boolean, saveAfterStop?: boolean) => Promise<void>
  >(async () => {})
  postSnapshotRef.current = async (force = false, includeReplay = false, saveAfterStop = false) => {
    if (!studentId || !assignmentId) return
    if ((!sharingRef.current || !enabled) && !saveAfterStop) return
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
    const languageId = normalizeCodebenchLanguageId(language)
    const protectedCode = protectedCodeRef.current
    if (
      !sharingRef.current &&
      protectedCode &&
      codebenchLiveCodeToPersist(protectedCode, latestCode, languageId) !== latestCode
    ) {
      return
    }
    const unchanged = latestCode === lastPostedCodeRef.current
    if (!force && unchanged) return
    if (!force && !latestCode.trim()) return

    const now = Date.now()
    const replayToSend = trimTypingReplay(replayRef.current, MAX_LIVE_REPLAY_EVENTS)
    const replayMark = replayMarkOf(replayRef.current)
    const sendReplay =
      includeReplay &&
      replayToSend.events.length > 0 &&
      replayMark !== lastReplayMarkRef.current &&
      now - lastReplayPostRef.current >= LIVE_STUDENT_SNAPSHOT_REPLAY_MS &&
      replayReconstructsTo(replayToSend, latestCode)
    // An unchanged buffer is a heartbeat: the server already has this code.
    const presenceOnly = unchanged && !sendReplay && !saveAfterStop

    pendingRef.current = true
    try {
      const response = await studentApiFetch("/api/codebench/live-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assignmentId: Number(assignmentId),
          code: presenceOnly ? undefined : latestCode,
          language,
          fileName,
          studentCursor: readEditorCursor(editorRefStable.current),
          typingReplay: sendReplay ? replayToSend : undefined,
          clientNow: sendReplay ? Date.now() : undefined,
          intent: presenceOnly ? "presence" : "code",
          keepJoined: saveAfterStop ? false : true,
        }),
        keepalive: true,
      })
      if (response.ok) {
        lastPostRef.current = Date.now()
        lastPostedCodeRef.current = latestCode
        if (!isCodebenchBoilerplate(latestCode, languageId)) protectedCodeRef.current = latestCode
        if (sendReplay) {
          lastReplayPostRef.current = Date.now()
          lastReplayMarkRef.current = replayMark
        }
        if (!saveAfterStop) noteServerAccepted()
      } else {
        const message = await readLiveError(response)
        if (!saveAfterStop) noteServerRejected(response.status, message)
        if (process.env.NODE_ENV === "development") {
          console.warn("[codebench live-snapshot]", response.status, message ?? "")
        }
      }
    } catch {
      /* best effort */
    } finally {
      pendingRef.current = false
      if (saveAfterStop) return
      if (!sharingRef.current && studentId && assignmentId) {
        const retry = needsRetryRef.current
        needsRetryRef.current = false
        void sendLiveEditorLeave(studentId, assignmentId)
        if (retry) void postSnapshotRef.current(true, false, true)
        return
      }
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
      const latestCode = stripCodebenchProbeComments(
        readEditorCode(editorRefStable.current, codeRef.current),
      )
      if (latestCode.trim() && latestCode !== lastPostedCodeRef.current) {
        void postSnapshotRef.current(true, false, true)
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
          serverNow?: number
        }
        const serverClockOffsetMs =
          typeof data.serverNow === "number" && Number.isFinite(data.serverNow)
            ? Date.now() - data.serverNow
            : 0
        seedLiveInstructorPushBaseline(studentId, assignmentId, Number(data.instructorRevision) || 0)
        const saved = typeof data.code === "string" ? data.code : ""
        if (saved.trim() && !isCodebenchBoilerplate(saved, normalizeCodebenchLanguageId(language))) {
          protectedCodeRef.current = saved
        }
        if (saved.trim()) onRestoreRef.current?.(saved)
        const restoredReplay = selectFaithfulTypingReplay(data.typingReplay, saved)
        if (restoredReplay) {
          replayRef.current = trimTypingReplay(shiftTypingReplayClock(restoredReplay, serverClockOffsetMs))
        }
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
    const generation = ++editorPresenceRef.current
    void sendLiveEditorJoin(studentId, assignmentId).then((result) => {
      if (!sharingRef.current) {
        void sendLiveEditorLeave(studentId, assignmentId)
        return
      }
      if (editorPresenceRef.current !== generation) return
      if (result.status != null && result.status >= 200 && result.status < 300) noteServerAccepted()
      else if (result.status != null) noteServerRejected(result.status, result.error)
    })
    return () => {
      // Same-document remount: the next effect already bumped generation, so skip.
      // Full page refresh: keep the join if this window is about to resume it.
      // Leaving the editor tab (no pagehide) still sends leave.
      queueMicrotask(() => {
        if (editorPresenceRef.current !== generation) return
        if (unloadingRef.current && shouldKeepJoinAcrossUnload(studentId, assignmentId)) return
        void sendLiveEditorLeave(studentId, assignmentId)
      })
    }
  }, [assignmentId, enabled, noteServerAccepted, noteServerRejected, studentId])

  useEffect(() => {
    if (!enabled || !studentId || !assignmentId) return
    const onPageHide = () => {
      unloadingRef.current = true
      editorPresenceRef.current += 1
      sendLiveEditorLeaveOnUnload(studentId, assignmentId)
    }
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [assignmentId, enabled, studentId])

  return { noteExternalApply, restoreReady, connection }
}
