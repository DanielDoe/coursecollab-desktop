"use client"

import "./live-replay-studio.css"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Keyboard,
  Loader2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { LightCodeViewer } from "@/components/light-code-viewer"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import {
  getDocumentAtTime,
  getTimeSpentMs,
  type TypingReplay,
} from "@/lib/typing-replay"
import { replayReconstructsTo, resolveLiveReplayDisplayCode } from "@/lib/codebench-live-replay"
import { cn } from "@/lib/utils"

const SPEEDS = [0.5, 1, 2, 4] as const

type Props = {
  replay: TypingReplay | null | undefined
  liveCode: string | null
  fileName?: string | null
  language?: string | null
  isLive?: boolean
  codeSource?: "live" | "submitted" | null
  hasGradedSubmission?: boolean
  replayVersion?: string | null
  className?: string
  editable?: boolean
  sending?: boolean
  onSendToStudent?: (code: string) => void | Promise<void>
  onDisplayCodeChange?: (code: string) => void
  onRunStudentCode?: () => void
  runStudentLoading?: boolean
  runStudentDisabled?: boolean
  studentCursor?: { line: number; column: number } | null
}

function formatDuration(ms: number) {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${min}m ${s}s` : `${min}m`
}

function countLines(value: string) {
  if (!value) return 0
  return value.split("\n").length
}

function LiveReplayEmptyState({
  isLive,
  hasGradedSubmission,
}: {
  isLive: boolean
  hasGradedSubmission: boolean
}) {
  return (
    <div className="live-replay-studio__empty">
      <div className="live-replay-studio__empty-radar" aria-hidden>
        <span className="live-replay-studio__empty-ring live-replay-studio__empty-ring--outer" />
        <span className="live-replay-studio__empty-ring live-replay-studio__empty-ring--mid" />
        <span className="live-replay-studio__empty-core">
          <Keyboard className="h-5 w-5" />
        </span>
      </div>
      <div className="space-y-1 text-center">
        <p className="live-replay-studio__empty-title">
          {hasGradedSubmission ? "Submitted code unavailable" : "Listening for keystrokes"}
        </p>
        <p className="live-replay-studio__empty-copy">
          {hasGradedSubmission
            ? "This student was graded, but their solution file was not stored with the Classroom Points record."
            : "Code will stream here as the student types in CodeBench."}
        </p>
      </div>
      {isLive ? (
        <div className="live-replay-studio__live-pill">
          <span className="live-replay-studio__live-dot" />
          Live session active
        </div>
      ) : hasGradedSubmission ? null : (
        <p className="live-replay-studio__empty-hint">Student has not started yet</p>
      )}
    </div>
  )
}

export function LiveTypingReplayPanel({
  replay,
  liveCode,
  fileName,
  language,
  isLive = false,
  codeSource = null,
  hasGradedSubmission = false,
  className,
  editable = false,
  sending = false,
  onSendToStudent,
  onDisplayCodeChange,
  onRunStudentCode,
  runStudentLoading = false,
  runStudentDisabled = false,
  studentCursor = null,
}: Props) {
  const { isDark } = useAppearance()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [followLive, setFollowLive] = useState(true)
  const [draft, setDraft] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<"idle" | "sending" | "error">("idle")
  const editorHostRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(220)
  const editing = draft != null
  const canEdit = editable && editing

  useEffect(() => {
    const node = editorHostRef.current
    if (!node) return
    const measure = () => {
      setEditorHeight(Math.max(160, Math.round(node.getBoundingClientRect().height)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const hasReplay = Boolean(replay?.events?.length) && replayReconstructsTo(replay, liveCode)
  const totalMs = hasReplay ? Math.max(...replay!.events.map((e) => e.t), 0) + 500 : 0
  const timeSpentMs = getTimeSpentMs(hasReplay ? replay : null)

  const showReplayFrames = hasReplay && !followLive && !editing
  const isAtEnd = hasReplay && currentMs >= totalMs
  const replayDoc = showReplayFrames ? getDocumentAtTime(replay, currentMs) : null
  const streamedCode = resolveLiveReplayDisplayCode({
    liveCode,
    replayDoc,
    showReplayFrames,
    isAtEnd,
  })
  const displayCode = editing ? draft! : streamedCode
  const hasCode = displayCode.trim().length > 0
  const showEditor = hasCode || editable
  const lineCount = countLines(displayCode)
  const charCount = displayCode.length
  const displayLanguage = language?.trim() || "C++"
  const displayFile = fileName?.trim() || "main.cpp"

  useEffect(() => {
    onDisplayCodeChange?.(displayCode)
  }, [displayCode, onDisplayCodeChange])

  useEffect(() => {
    if (isLive && followLive) {
      setIsPlaying(false)
      if (hasReplay) setCurrentMs(totalMs)
    }
  }, [followLive, hasReplay, isLive, liveCode, totalMs])

  const beginHelpEdit = () => {
    setDraft(streamedCode)
    setFollowLive(false)
    setIsPlaying(false)
    setSyncState("idle")
  }

  const returnToLive = () => {
    setDraft(null)
    setFollowLive(true)
    setIsPlaying(false)
    setSyncState("idle")
  }

  const sendToStudent = async () => {
    if (!onSendToStudent || draft == null || !draft.trim()) return
    setSyncState("sending")
    try {
      await onSendToStudent(draft)
      setDraft(null)
      setFollowLive(true)
      setSyncState("idle")
    } catch {
      setSyncState("error")
    }
  }

  const tick = useCallback(() => {
    setCurrentMs((prev) => {
      const next = prev + 50 * SPEEDS[speedIndex]
      if (next >= totalMs) {
        setIsPlaying(false)
        return totalMs
      }
      return next
    })
  }, [speedIndex, totalMs])

  useEffect(() => {
    if (!isPlaying || !hasReplay) return
    const id = window.setInterval(tick, 50)
    return () => window.clearInterval(id)
  }, [hasReplay, isPlaying, tick])

  const handlePlayPause = () => {
    const restartFromStart = followLive || currentMs >= totalMs
    setFollowLive(false)
    if (restartFromStart) setCurrentMs(0)
    setIsPlaying((p) => !p)
  }

  const submittedView = codeSource === "submitted" || (!isLive && hasCode)
  const statusLabel = editing
    ? syncState === "sending" || sending
      ? "Sending your fix to the student…"
      : syncState === "error"
        ? "Could not send — try again"
        : "Editing a fix — student stream paused here until you send or follow live"
    : hasReplay
      ? `Typing replay · ${formatDuration(timeSpentMs)}`
      : isLive
        ? "Following student live"
        : submittedView
          ? "Submitted Classroom Points solution"
          : "No code captured yet"

  return (
    <div className={cn("live-replay-studio flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="live-replay-studio__shell flex min-h-0 flex-1 flex-col">
        <div className="live-replay-studio__titlebar">
          <div className="live-replay-studio__traffic" aria-hidden>
            <Circle className="live-replay-studio__dot live-replay-studio__dot--close" />
            <Circle className="live-replay-studio__dot live-replay-studio__dot--minimize" />
            <Circle className="live-replay-studio__dot live-replay-studio__dot--maximize" />
          </div>
          <div className="live-replay-studio__tab">
            <Sparkles className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
            <span className="truncate">{displayFile}</span>
          </div>
          <div className="live-replay-studio__titlebar-meta">
            <Badge variant="outline" className="live-replay-studio__lang-badge">
              {displayLanguage}
            </Badge>
            {isLive ? (
              <span className="live-replay-studio__live-pill live-replay-studio__live-pill--compact">
                <span className="live-replay-studio__live-dot" />
                {editing ? "Helping" : "Live"}
              </span>
            ) : submittedView ? (
              <Badge variant="outline" className="live-replay-studio__lang-badge">
                Submitted
              </Badge>
            ) : null}
            {studentCursor && isLive && !editing ? (
              <span className="text-[10px] tabular-nums text-[var(--cc-text-muted)]">
                Ln {studentCursor.line}, Col {studentCursor.column}
              </span>
            ) : null}
            <div className="live-replay-studio__actions">
              {editable && isLive && !editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 px-2.5 text-[11px]"
                  onClick={beginHelpEdit}
                >
                  <Wrench className="mr-1 h-3.5 w-3.5" />
                  Help edit
                </Button>
              ) : null}
              {editing ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 px-2.5 text-[11px]"
                    onClick={returnToLive}
                    disabled={sending || syncState === "sending"}
                  >
                    <Radio className="mr-1 h-3.5 w-3.5" />
                    Follow live
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 px-2.5 text-[11px]"
                    onClick={() => void sendToStudent()}
                    disabled={sending || syncState === "sending" || !draft?.trim()}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {sending || syncState === "sending" ? "Sending…" : "Send to student"}
                  </Button>
                </>
              ) : hasReplay && !followLive ? (
                <Button
                  type="button"
                  size="sm"
                  variant={followLive ? "default" : "outline"}
                  className="h-8 shrink-0 px-2.5 text-[11px]"
                  onClick={returnToLive}
                >
                  <Radio className="mr-1 h-3.5 w-3.5" />
                  Follow live
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div ref={editorHostRef} className="live-replay-studio__editor-host min-h-[220px] flex-1">
          {showEditor ? (
            <LightCodeViewer
              value={displayCode}
              height={`${editorHeight}px`}
              language={language}
              theme={isDark ? "dark" : "light"}
              className="live-replay-studio__cm h-full"
              editable={canEdit}
              onChange={(value) => {
                if (!canEdit) return
                setDraft(value)
              }}
            />
          ) : (
            <LiveReplayEmptyState isLive={isLive} hasGradedSubmission={hasGradedSubmission} />
          )}
        </div>

        <div className="live-replay-studio__statusbar">
          <div className="live-replay-studio__statusbar-meta">
            <span>{statusLabel}</span>
            {hasCode ? (
              <>
                <span className="live-replay-studio__sep">·</span>
                <span>
                  {lineCount} {lineCount === 1 ? "line" : "lines"}
                </span>
                <span className="live-replay-studio__sep">·</span>
                <span>{charCount} chars</span>
              </>
            ) : null}
            {followLive && isLive && !editing ? (
              <>
                <span className="live-replay-studio__sep">·</span>
                <span className="live-replay-studio__following">Following live</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {hasReplay || onRunStudentCode ? (
        <div className="live-replay-studio__controls space-y-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-2.5">
          {hasReplay ? (
            <div className="flex items-center gap-2">
              <Slider
                value={[currentMs]}
                max={totalMs}
                step={100}
                onValueChange={(v) => {
                  setFollowLive(false)
                  setCurrentMs(v[0])
                  if (isPlaying) setIsPlaying(false)
                }}
                className="flex-1"
              />
              <span className="w-20 text-right text-xs tabular-nums text-[var(--cc-text-muted)]">
                {Math.round(currentMs / 1000)}s / {Math.round(totalMs / 1000)}s
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {onRunStudentCode ? (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={onRunStudentCode}
                disabled={runStudentDisabled || runStudentLoading || !hasCode}
                title="Run what you see in the editor (C++) in the panel on the right"
              >
                {runStudentLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run student code
              </Button>
            ) : null}
            {onRunStudentCode && hasReplay ? (
              <div className="mx-0.5 h-6 w-px shrink-0 bg-[var(--border)]" aria-hidden />
            ) : null}
            {hasReplay ? (
              <>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setFollowLive(false)
                    setCurrentMs(0)
                    setIsPlaying(false)
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setFollowLive(false)
                    setCurrentMs(Math.max(0, currentMs - 500))
                    setIsPlaying(false)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setFollowLive(false)
                    setCurrentMs(Math.min(totalMs, currentMs + 500))
                    if (isPlaying && currentMs + 500 >= totalMs) setIsPlaying(false)
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="ml-1 flex gap-1 border-l border-[var(--border)] pl-2">
                  {SPEEDS.map((s, i) => (
                    <Button
                      key={s}
                      type="button"
                      variant={speedIndex === i ? "default" : "ghost"}
                      size="sm"
                      className="h-8 min-w-9 px-2 text-[11px]"
                      onClick={() => setSpeedIndex(i)}
                    >
                      {s}x
                    </Button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
