"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  Square,
  Search,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { LiveTypingReplayPanel } from "@/components/codebench/LiveTypingReplayPanel"
import {
  LiveInstructorRunPanel,
  type LiveInstructorRunPanelHandle,
} from "@/components/instructor/codebench/LiveInstructorRunPanel"
import {
  InstructorClassroomQuestionButton,
  InstructorClassroomQuestionDrawer,
} from "@/components/instructor/codebench/InstructorClassroomQuestionDrawer"
import { invalidateInstructorClassroomAssignmentsCache } from "@/hooks/use-instructor-classroom-assignments"
import { notifyInstructorClassroomAssignmentsChanged } from "@/lib/instructor-classroom-assignments-changed"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import type { InstructorClassroomHandoff } from "@/lib/codebench-instructor-classroom"
import type {
  LiveClassroomSessionPayload,
  LiveClassroomStudentRow,
  LiveStudentStatus,
} from "@/lib/codebench-live-classroom-types"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"
import { useInstructorCloudEditorFile } from "@/hooks/use-instructor-cloud-editor-file"
import { stripCodebenchProbeComments } from "@/lib/codebench-strip-probe-comments"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"
import { useToast } from "@/hooks/use-toast"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"
import {
  LIVE_INSTRUCTOR_CODE_POLL_MS,
  LIVE_INSTRUCTOR_REPLAY_REFRESH_MS,
  LIVE_INSTRUCTOR_SESSION_POLL_MS,
  liveInstructorSelectedKey,
} from "@/lib/codebench-live-timing"

type Props = {
  handoff: InstructorClassroomHandoff
  onBack: () => void
  onOpenInIde: (handoff: InstructorClassroomHandoff) => void
}


type RosterFilter = "all" | "attention" | "coding" | "joined" | "submitted" | "approved"

function formatWhen(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })
}

function statusTone(status: LiveStudentStatus) {
  switch (status) {
    case "approved":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "submitted":
      return "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300"
    case "error":
      return "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
    case "needs_help":
      return "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300"
    case "joined":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    case "coding":
      return "border-[color-mix(in_srgb,var(--cc-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--card))] text-[var(--cc-accent)]"
    case "review":
      return "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300"
    default:
      return "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text-muted)]"
  }
}

function eventToneClass(tone: LiveClassroomSessionPayload["recentEvents"][number]["tone"]) {
  switch (tone) {
    case "error":
      return "text-red-600 dark:text-red-300"
    case "ok":
      return "text-emerald-600 dark:text-emerald-300"
    case "tool":
      return "text-[var(--cc-accent)]"
    case "submit":
      return "text-blue-600 dark:text-blue-300"
    default:
      return "text-[var(--cc-text-muted)]"
  }
}

function statusIcon(status: LiveStudentStatus) {
  switch (status) {
    case "approved":
      return CheckCircle2
    case "error":
      return AlertTriangle
    case "needs_help":
      return HelpCircle
    case "coding":
      return Radio
    default:
      return Users
  }
}

function rosterBucket(status: LiveStudentStatus): "attention" | "present" | "finished" | "approved" | "absent" {
  switch (status) {
    case "needs_help":
    case "error":
      return "attention"
    case "coding":
    case "joined":
      return "present"
    case "submitted":
    case "review":
      return "finished"
    case "approved":
      return "approved"
    default:
      return "absent"
  }
}

const FLAG_LABEL: Record<LiveStudentStatus, string> = {
  not_started: "Not started",
  joined: "Joined",
  coding: "Coding now",
  error: "Compile error",
  needs_help: "Needs help",
  submitted: "Submitted",
  approved: "Approved",
  review: "Awaiting review",
}

function rosterFlags(row: LiveClassroomStudentRow): LiveStudentStatus[] {
  const flags: LiveStudentStatus[] = []
  const inRoom =
    row.status === "joined" ||
    row.status === "coding" ||
    row.status === "error" ||
    row.status === "needs_help"
  if (inRoom) flags.push("joined")
  if (row.status === "coding" || row.status === "error" || row.status === "needs_help") flags.push("coding")
  if (row.status === "error") flags.push("error")
  if (row.status === "needs_help") flags.push("needs_help")
  const submission = String(row.submissionStatus ?? "").toLowerCase()
  if (submission === "approved") flags.push("approved")
  else if (submission === "rejected" || submission === "needs_review") flags.push("review")
  else if (submission === "pending" || submission === "submitted") flags.push("submitted")
  else if (!inRoom && (row.status === "submitted" || row.status === "approved" || row.status === "review")) {
    flags.push(row.status)
  }
  if (flags.length === 0 && row.status !== "not_started") flags.push(row.status)
  return flags
}

function StatusFlags({ row }: { row: LiveClassroomStudentRow }) {
  return (
    <>
      {rosterFlags(row).map((flag) => (
        <Badge key={flag} variant="outline" className={cn("text-[10px]", statusTone(flag))}>
          {FLAG_LABEL[flag]}
        </Badge>
      ))}
    </>
  )
}

function rosterRank(bucket: ReturnType<typeof rosterBucket>): number {
  switch (bucket) {
    case "attention":
      return 0
    case "present":
      return 1
    case "finished":
      return 2
    case "approved":
      return 3
    default:
      return 4
  }
}

function uniqueCompilerLines(lines: Array<string | null | undefined>, limit = 3): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const text = line?.replace(/\s+/g, " ").trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

function compilerErrorLines(
  row: LiveClassroomStudentRow,
  recentEvents: LiveClassroomSessionPayload["recentEvents"],
): string[] {
  const stored = uniqueCompilerLines(row.compileErrorMessages ?? [])
  if (stored.length) return stored
  const fromRecent = uniqueCompilerLines(
    recentEvents
      .filter((event) => event.studentDbId === row.studentDbId && event.tone === "error")
      .map((event) => event.detail),
  )
  if (fromRecent.length) return fromRecent
  const detail = row.latestEventDetail?.trim()
  const title = row.latestEventTitle ?? ""
  const latestIsError =
    row.compileErrors > 0 &&
    Boolean(detail) &&
    !/clean compile|ran program|saved workspace|submitted/i.test(title)
  return latestIsError && detail ? [detail] : []
}

function matchesFilter(row: LiveClassroomStudentRow, filter: RosterFilter): boolean {
  switch (filter) {
    case "attention":
      return row.status === "needs_help" || row.status === "error"
    case "joined":
      return row.status === "joined"
    case "coding":
      return row.status === "coding"
    case "submitted":
      return row.status === "submitted" || row.status === "review"
    case "approved":
      return row.status === "approved"
    default:
      return true
  }
}

function StudentRowButton({
  row,
  selected,
  shownAt,
  faceStatus,
  errorLines,
  onSelect,
}: {
  row: LiveClassroomStudentRow
  selected: boolean
  shownAt: string | null
  faceStatus: LiveStudentStatus
  faceLabel: string
  errorLines: string[]
  onSelect: () => void
}) {
  const Icon = statusIcon(faceStatus)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-[var(--cc-accent)] bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))]"
          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40",
      )}
    >
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md", statusTone(faceStatus))}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-[var(--cc-text)]">{row.fullName}</p>
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--cc-text-muted)]">
            {formatWhen(shownAt)}
          </span>
        </div>
        <p className="text-xs text-[var(--cc-text-muted)]">{row.studentId}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusFlags row={row} />
          {row.compileErrors > 0 ? (
            <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-300">
              {row.compileErrors} error{row.compileErrors === 1 ? "" : "s"}
            </Badge>
          ) : null}
          {errorLines.map((line) => (
            <span
              key={line}
              title={line}
              className="basis-full text-[10px] leading-snug text-red-600 dark:text-red-300"
            >
              {line}
            </span>
          ))}
          {row.points != null ? (
            <Badge variant="outline" className="text-[10px]">
              {row.points} pts
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  )
}

type FocusedLiveCode = {
  code: string
  language: string | null
  fileName: string | null
  studentCursor: { line: number; column: number } | null
  updatedAt: string | null
}

function snapshotMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function studentIsInLiveEditor(status: LiveStudentStatus): boolean {
  return status === "coding" || status === "error" || status === "needs_help" || status === "joined"
}

/** A slow roster response must not paint over code that already arrived on the fast path. */
function keepFresherLiveCode(
  incoming: LiveClassroomSessionPayload,
  previous: LiveClassroomSessionPayload | null,
): LiveClassroomSessionPayload {
  if (!previous) return incoming
  const prior = new Map(previous.students.map((student) => [student.studentDbId, student]))
  return {
    ...incoming,
    students: incoming.students.map((student) => {
      if (!studentIsInLiveEditor(student.status)) return student
      const older = prior.get(student.studentDbId)
      const olderMs = snapshotMs(older?.snapshotUpdatedAt)
      const incomingMs = snapshotMs(student.snapshotUpdatedAt)
      if (!older || olderMs == null || incomingMs == null || olderMs <= incomingMs) return student
      return {
        ...student,
        code: older.code,
        codeSource: older.codeSource ?? student.codeSource,
        language: older.language ?? student.language,
        fileName: older.fileName ?? student.fileName,
        studentCursor: older.studentCursor,
        snapshotUpdatedAt: older.snapshotUpdatedAt,
      }
    }),
  }
}

/** Roster polls sent with replay=0 omit the replay; keep the one already loaded. */
function carryTypingReplay(
  incoming: LiveClassroomSessionPayload,
  previous: LiveClassroomSessionPayload | null,
): LiveClassroomSessionPayload {
  if (!previous) return incoming
  const prior = new Map(previous.students.map((student) => [student.studentDbId, student]))
  return {
    ...incoming,
    students: incoming.students.map((student) => {
      if (student.typingReplay) return student
      const older = prior.get(student.studentDbId)
      return older?.typingReplay ? { ...student, typingReplay: older.typingReplay } : student
    }),
  }
}

function withFocusedLiveCode(
  payload: LiveClassroomSessionPayload,
  studentDbId: number,
  next: FocusedLiveCode,
): LiveClassroomSessionPayload | null {
  const index = payload.students.findIndex((student) => student.studentDbId === studentDbId)
  if (index < 0) return null
  const current = payload.students[index]
  if (!next.code.trim() && (current.code?.trim().length ?? 0) > 0) return null
  if (!studentIsInLiveEditor(current.status)) {
    const incomingMs = snapshotMs(next.updatedAt)
    const currentMs = snapshotMs(current.snapshotUpdatedAt)
    if (incomingMs != null && currentMs != null && incomingMs < currentMs) return null
  }
  const sameCode = (current.code ?? "") === next.code
  const sameAt = (current.snapshotUpdatedAt ?? null) === (next.updatedAt ?? null)
  const sameCursor =
    (current.studentCursor?.line ?? null) === (next.studentCursor?.line ?? null) &&
    (current.studentCursor?.column ?? null) === (next.studentCursor?.column ?? null)
  if (sameCode && sameAt && sameCursor) return null
  const students = payload.students.slice()
  students[index] = {
    ...current,
    code: next.code,
    codeSource: next.code.trim() ? "live" : current.codeSource,
    language: next.language ?? current.language,
    fileName: next.fileName ?? current.fileName,
    studentCursor: next.studentCursor ?? current.studentCursor,
    snapshotUpdatedAt: next.updatedAt ?? current.snapshotUpdatedAt,
  }
  return { ...payload, students }
}

function CompactActionTip({
  label,
  enabled,
  children,
}: {
  label: string
  enabled: boolean
  children: ReactElement
}) {
  if (!enabled) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function InstructorLiveClassroomSession({ handoff, onBack, onOpenInIde }: Props) {
  const scopeKey = useInstructorScopeKey()
  const chrome = facultyEmbedChrome("codebench")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LiveClassroomSessionPayload | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => {
    try {
      const stored = Number(sessionStorage.getItem(liveInstructorSelectedKey(handoff.submissionId)))
      return Number.isFinite(stored) && stored > 0 ? stored : null
    } catch {
      return null
    }
  })
  const [refreshing, setRefreshing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [questionOpen, setQuestionOpen] = useState(false)
  const [filter, setFilter] = useState<RosterFilter>("all")
  const [studentQuery, setStudentQuery] = useState("")
  const [pushing, setPushing] = useState(false)
  const [syncingStudent, setSyncingStudent] = useState(false)
  const [runPanelOpen, setRunPanelOpen] = useState(false)
  const [runLoading, setRunLoading] = useState(false)
  const [displayCodeForRun, setDisplayCodeForRun] = useState("")
  const runPanelRef = useRef<LiveInstructorRunPanelHandle | null>(null)
  const pendingRunCodeRef = useRef<string | null>(null)
  const { toast } = useToast()
  const { confirm } = useAppConfirm()
  const payloadRef = useRef<LiveClassroomSessionPayload | null>(null)
  const [submittedCodeByStudent, setSubmittedCodeByStudent] = useState<Map<number, string>>(
    () => new Map(),
  )

  useEffect(() => {
    payloadRef.current = payload
  }, [payload])

  useEffect(() => {
    pendingRunCodeRef.current = null
  }, [selectedStudentId])

  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || questionOpen) return
      setExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [expanded, questionOpen])

  useEffect(() => {
    let cancelled = false
    async function loadSubmittedSolutions() {
      try {
        const sessionQs = handoff.session?.trim()
          ? `?session=${encodeURIComponent(handoff.session.trim())}`
          : ""
        const res = await instructorApiFetch(
          `/api/instructor/classroom-points/export-data${sessionQs}`,
        )
        const parsed = await readInstructorApiJson<{ points?: Array<Record<string, unknown>> }>(
          res,
          "Classroom points solutions",
        )
        if (!parsed.ok || cancelled) return
        const next = new Map<number, string>()
        const assignmentId = Number(handoff.submissionId)
        const title = handoff.title.trim()
        for (const row of parsed.data.points ?? []) {
          const rawSubmissionId = row.submission_id
          const reason = typeof row.reason === "string" ? row.reason.trim() : ""
          const submissionTitle = typeof row.submission_title === "string" ? row.submission_title.trim() : ""
          const matchesAssignment =
            Number(rawSubmissionId) === assignmentId ||
            ((rawSubmissionId == null || rawSubmissionId === "") &&
              title.length > 0 &&
              (reason.startsWith(title) || submissionTitle === title || submissionTitle.startsWith(title)))
          if (!matchesAssignment) continue
          const code =
            (typeof row.code === "string" && row.code.trim() && row.code) ||
            (typeof row.submission_code === "string" && row.submission_code.trim() && row.submission_code) ||
            null
          if (!code) continue
          const studentDbId = Number(row.student_id)
          if (!Number.isFinite(studentDbId) || next.has(studentDbId)) continue
          next.set(studentDbId, stripCodebenchProbeComments(code))
        }
        if (!cancelled) setSubmittedCodeByStudent(next)
      } catch {
        /* best effort — live snapshots still work without this fallback */
      }
    }
    void loadSubmittedSolutions()
    return () => {
      cancelled = true
    }
  }, [handoff.session, handoff.submissionId, handoff.title, scopeKey])

  const selectedStudentIdRef = useRef(selectedStudentId)
  selectedStudentIdRef.current = selectedStudentId

  const rosterInFlightRef = useRef(false)
  const rosterSeqRef = useRef(0)
  const replayFetchRef = useRef<{ studentId: number | null; at: number }>({ studentId: null, at: 0 })

  /**
   * silent + !force is the background poll: it is skipped while another roster request is
   * pending or the window is hidden. Selection changes and manual refreshes pass force.
   * Responses that arrive after a newer request started are dropped.
   */
  const load = useCallback(async (silent = false, showRefresh = false, force = false) => {
    const background = silent && !force && !showRefresh
    if (background) {
      if (rosterInFlightRef.current) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
    }
    const seq = ++rosterSeqRef.current
    rosterInFlightRef.current = true
    if (!silent) setLoading(true)
    else if (showRefresh) setRefreshing(true)
    if (!silent) setError(null)
    try {
      const focus = selectedStudentIdRef.current
      const focusQs = focus != null ? `&studentId=${encodeURIComponent(String(focus))}` : ""
      const lastReplay = replayFetchRef.current
      const wantReplay =
        focus != null &&
        (!background ||
          lastReplay.studentId !== focus ||
          Date.now() - lastReplay.at >= LIVE_INSTRUCTOR_REPLAY_REFRESH_MS)
      const res = await instructorApiFetch(
        `/api/instructor/codebench/live-session?assignmentId=${encodeURIComponent(String(handoff.submissionId))}${focusQs}&replay=${wantReplay ? "1" : "0"}`,
      )
      const parsed = await readInstructorApiJson<LiveClassroomSessionPayload>(res, "Live classroom session")
      if (seq !== rosterSeqRef.current) return
      if (!parsed.ok) throw new Error(parsed.error)
      if (wantReplay) replayFetchRef.current = { studentId: focus, at: Date.now() }
      setPayload((prev) => {
        const merged = keepFresherLiveCode(parsed.data, prev)
        return wantReplay ? merged : carryTypingReplay(merged, prev)
      })
      setError(null)
      setSelectedStudentId((prev) => {
        if (prev != null && parsed.data.students.some((s) => s.studentDbId === prev)) return prev
        const priority = parsed.data.students.find((s) =>
          ["needs_help", "error", "coding"].includes(s.status),
        )
        return priority?.studentDbId ?? parsed.data.students[0]?.studentDbId ?? null
      })
    } catch (err) {
      if (seq !== rosterSeqRef.current) return
      const message = err instanceof Error ? err.message : "Failed to load live session"
      if (!silent || !payloadRef.current) setError(message)
    } finally {
      if (seq === rosterSeqRef.current) {
        rosterInFlightRef.current = false
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [handoff.submissionId, scopeKey])

  useEffect(() => {
    void load()
  }, [load])

  useImmediateLivePoll(() => void load(true, false), LIVE_INSTRUCTOR_SESSION_POLL_MS)

  const liveCodeMissingRef = useRef(false)
  const liveCodeBusyRef = useRef(false)

  const pollFocusedCode = useCallback(async () => {
    if (liveCodeMissingRef.current || liveCodeBusyRef.current) return
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return
    const studentId = selectedStudentIdRef.current
    if (studentId == null || !payloadRef.current) return
    liveCodeBusyRef.current = true
    try {
      const res = await instructorApiFetch(
        `/api/instructor/codebench/live-code?assignmentId=${encodeURIComponent(String(handoff.submissionId))}&studentId=${encodeURIComponent(String(studentId))}`,
      )
      if (res.status === 404) {
        liveCodeMissingRef.current = true
        window.setTimeout(() => {
          liveCodeMissingRef.current = false
        }, 15000)
        return
      }
      const parsed = await readInstructorApiJson<FocusedLiveCode>(res, "Live code")
      if (!parsed.ok || selectedStudentIdRef.current !== studentId) return
      setPayload((prev) => (prev ? withFocusedLiveCode(prev, studentId, parsed.data) ?? prev : prev))
    } catch {
      /* The roster poll still refreshes code if this read fails. */
    } finally {
      liveCodeBusyRef.current = false
    }
  }, [handoff.submissionId])

  useEffect(() => {
    liveCodeMissingRef.current = false
  }, [handoff.submissionId])

  useImmediateLivePoll(
    () => void pollFocusedCode(),
    LIVE_INSTRUCTOR_CODE_POLL_MS,
    selectedStudentId != null,
  )

  useEffect(() => {
    if (selectedStudentId == null) return
    try {
      sessionStorage.setItem(liveInstructorSelectedKey(handoff.submissionId), String(selectedStudentId))
    } catch {
      /* quota / private mode */
    }
    void load(true, false, true)
  }, [handoff.submissionId, load, selectedStudentId])

  const handleEndSession = useCallback(async () => {
    const confirmed = await confirm({
      title: "End this live session?",
      description:
        "Students will no longer see it in CodeBench, and keystroke listening will stop.",
      confirmLabel: "End session",
      cancelLabel: "Keep session",
      variant: "destructive",
    })
    if (!confirmed) return
    setEnding(true)
    try {
      const res = await instructorApiFetch(
        `/api/instructor/codebench/live-session?assignmentId=${encodeURIComponent(String(handoff.submissionId))}`,
        { method: "DELETE" },
      )
      const parsed = await readInstructorApiJson<{ ok?: boolean }>(res, "End live session")
      if (!parsed.ok) throw new Error(parsed.error)
      invalidateInstructorClassroomAssignmentsCache()
      notifyInstructorClassroomAssignmentsChanged()
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end live session")
    } finally {
      setEnding(false)
    }
  }, [confirm, handoff.submissionId, onBack])

  const rosterClockRef = useRef(new Map<number, { bucket: string; at: string | null }>())

  const filteredStudents = useMemo(() => {
    const rows = payload?.students ?? []
    const clocks = rosterClockRef.current
    const seen = new Set<number>()
    for (const row of rows) {
      seen.add(row.studentDbId)
      const bucket = rosterBucket(row.status)
      const prev = clocks.get(row.studentDbId)
      if (!prev || prev.bucket !== bucket) {
        clocks.set(row.studentDbId, { bucket, at: row.lastActivityAt })
      }
    }
    for (const id of clocks.keys()) {
      if (!seen.has(id)) clocks.delete(id)
    }
    const query = studentQuery.trim().toLowerCase()
    return [...rows]
      .sort((a, b) => {
        const diff = rosterRank(rosterBucket(a.status)) - rosterRank(rosterBucket(b.status))
        if (diff !== 0) return diff
        return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
      })
      .filter((row) => {
        if (!matchesFilter(row, filter)) return false
        if (!query) return true
        return (
          row.fullName.toLowerCase().includes(query) ||
          row.studentId.toLowerCase().includes(query) ||
          (row.section ?? "").toLowerCase().includes(query)
        )
      })
      .map((row) => ({
        row,
        shownAt: clocks.get(row.studentDbId)?.at ?? row.lastActivityAt,
        faceStatus: row.status,
        faceLabel: row.statusLabel,
      }))
  }, [filter, payload?.students, studentQuery])

  const selectedStudent = useMemo(
    () => payload?.students.find((s) => s.studentDbId === selectedStudentId) ?? null,
    [payload?.students, selectedStudentId],
  )

  const handleSendToStudent = useCallback(
    async (code: string) => {
      if (!selectedStudentId || !code.trim()) return
      setPushing(true)
      try {
        const res = await instructorApiFetch("/api/instructor/codebench/live-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: Number(handoff.submissionId),
            studentDbId: selectedStudentId,
            code,
            language: selectedStudent?.language ?? "cpp",
            fileName: selectedStudent?.fileName ?? "main.cpp",
          }),
        })
        const parsed = await readInstructorApiJson<{ ok?: boolean; revision?: number }>(
          res,
          "Send code to student",
        )
        if (!parsed.ok) throw new Error(parsed.error)
      } catch (err) {
        toast({
          title: "Could not sync to student",
          description: err instanceof Error ? err.message : "Try again in a moment.",
          variant: "destructive",
        })
        throw err
      } finally {
        setPushing(false)
      }
    },
    [handoff.submissionId, selectedStudent?.fileName, selectedStudent?.language, selectedStudentId, toast],
  )

  const selectedStudentCode = selectedStudent
    ? stripCodebenchProbeComments(
        selectedStudent.code?.trim() || submittedCodeByStudent.get(selectedStudent.studentDbId) || "",
      ) || null
    : null
  const cloudEditorFile = useInstructorCloudEditorFile(selectedStudent && !selectedStudentCode ? selectedStudent.studentDbId : null)

  const resolveRunnableCode = useCallback(() => {
    return stripCodebenchProbeComments((displayCodeForRun || selectedStudentCode || "").trim())
  }, [displayCodeForRun, selectedStudentCode])

  const handleTerminalReady = useCallback(() => {
    const code = pendingRunCodeRef.current
    if (!code) return
    pendingRunCodeRef.current = null
    void runPanelRef.current?.run(code)
  }, [])

  const handleSyncStudentCode = useCallback(async () => {
    if (!selectedStudentId || syncingStudent) return
    setSyncingStudent(true)
    try {
      const res = await instructorApiFetch("/api/instructor/codebench/live-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: Number(handoff.submissionId),
          studentDbId: selectedStudentId,
        }),
      })
      const parsed = await readInstructorApiJson<{ ok?: boolean }>(res, "Sync from student")
      if (!parsed.ok) throw new Error(parsed.error)
      toast({
        title: "Sync requested",
        description: "The student editor will save its current file into the live snapshot.",
      })
    } catch (err) {
      toast({
        title: "Could not request a sync",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setSyncingStudent(false)
    }
  }, [handoff.submissionId, selectedStudentId, syncingStudent, toast])

  const handleOpenRunPanel = useCallback(() => {
    const code = resolveRunnableCode()
    if (!code) {
      toast({
        title: "No code to run",
        description: "Wait for the student to type or pick a snapshot with code in the editor.",
        variant: "destructive",
      })
      return
    }
    if (runPanelOpen) {
      void runPanelRef.current?.run(code)
      return
    }
    pendingRunCodeRef.current = code
    setRunPanelOpen(true)
  }, [resolveRunnableCode, runPanelOpen, toast])

  const selectedCodeSource =
    selectedStudent?.codeSource ??
    (selectedStudent?.snapshotUpdatedAt
      ? "live"
      : selectedStudentCode
        ? "submitted"
        : null)

  // Live follows the roster status. A leave clears that status on the next poll.
  const isStudentLive =
    selectedStudent?.status === "coding" ||
    selectedStudent?.status === "error" ||
    selectedStudent?.status === "needs_help" ||
    selectedStudent?.status === "joined"

  const filterButtons: Array<{ id: RosterFilter; label: string; count?: number }> = [
    { id: "all", label: "All", count: payload?.summary.totalStudents },
    {
      id: "attention",
      label: "Need attention",
      count: (payload?.summary.needsHelp ?? 0) + (payload?.summary.errors ?? 0),
    },
    { id: "coding", label: "Coding", count: payload?.summary.coding },
    { id: "joined", label: "Joined", count: payload?.summary.joined },
    { id: "submitted", label: "Submitted", count: (payload?.summary.submitted ?? 0) + (payload?.summary.review ?? 0) },
    { id: "approved", label: "Done", count: payload?.summary.approved },
  ]

  const summary = payload?.summary
  const sessionClosed = payload?.isOpen === false

  return (
    <div
      className={cn(
        "instructor-live-session flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden",
        expanded && "instructor-live-session--expanded",
      )}
    >
      <div className={cn(chrome.card, "shrink-0 space-y-2 px-3 py-2.5 sm:px-4")}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <Breadcrumb className="min-w-0 overflow-hidden" aria-label="Live classroom">
              <BreadcrumbList className="flex-nowrap gap-1 text-xs sm:gap-1.5 sm:text-sm">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      onClick={onBack}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-md px-1 py-0.5 font-medium transition-colors hover:bg-[var(--muted)]/60",
                        PORTAL_TEXT_MUTED,
                      )}
                      title="Return to the live classroom list. This session stays open."
                    >
                      Live Classroom
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[var(--cc-text-muted)] [&>svg]:size-3.5" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className={cn("truncate font-semibold", PORTAL_TEXT)}>
                    {handoff.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0 text-[10px]",
                sessionClosed ? "" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {sessionClosed ? "Closed" : "Live"}
            </Badge>
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--cc-text-muted)]" />
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <CompactActionTip label="Refresh roster" enabled={!expanded}>
              <Button
                type="button"
                size={expanded ? "sm" : "icon"}
                variant="outline"
                className={expanded ? "h-8" : "h-8 w-8"}
                onClick={() => void load(true, true)}
                disabled={loading}
                aria-label="Refresh roster"
              >
                {loading ? (
                  <Loader2 className={cn("h-3.5 w-3.5 animate-spin", expanded && "mr-1")} />
                ) : (
                  <RefreshCw className={cn("h-3.5 w-3.5", expanded && "mr-1")} />
                )}
                {expanded ? "Refresh" : null}
              </Button>
            </CompactActionTip>
            <CompactActionTip label={expanded ? "Exit full screen" : "Expand live classroom"} enabled={!expanded}>
              <Button
                type="button"
                size={expanded ? "sm" : "icon"}
                variant={expanded ? "default" : "outline"}
                className={expanded ? "h-8" : "h-8 w-8"}
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "Exit expanded live classroom" : "Expand live classroom"}
                aria-pressed={expanded}
              >
                {expanded ? <Minimize2 className="mr-1 h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {expanded ? "Exit full screen" : null}
              </Button>
            </CompactActionTip>
            <CompactActionTip label="Question" enabled={!expanded}>
              <InstructorClassroomQuestionButton
                open={questionOpen}
                showLabel={expanded}
                onClick={() => setQuestionOpen((value) => !value)}
              />
            </CompactActionTip>
            <CompactActionTip label="Open in IDE" enabled={!expanded}>
              <Button
                type="button"
                size={expanded ? "sm" : "icon"}
                className={expanded ? "h-8" : "h-8 w-8"}
                onClick={() => onOpenInIde(handoff)}
                aria-label="Open in IDE"
              >
                <Code2 className={cn("h-3.5 w-3.5", expanded && "mr-1")} />
                {expanded ? "Open in IDE" : null}
              </Button>
            </CompactActionTip>
            <CompactActionTip label="End session" enabled={!expanded}>
              <Button
                type="button"
                size={expanded ? "sm" : "icon"}
                variant="destructive"
                className={expanded ? "h-8" : "h-8 w-8"}
                onClick={() => void handleEndSession()}
                disabled={ending}
                aria-label="End session"
              >
                {ending ? (
                  <Loader2 className={cn("h-3.5 w-3.5 animate-spin", expanded && "mr-1")} />
                ) : (
                  <Square className={cn("h-3.5 w-3.5", expanded && "mr-1")} />
                )}
                {expanded ? "End session" : null}
              </Button>
            </CompactActionTip>
          </div>
        </div>

        {summary ? (
          <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
            <span>{summary.totalStudents} students</span>
            <span className="text-sky-700 dark:text-sky-300">{summary.joined} joined</span>
            <span className="text-[var(--cc-accent)]">{summary.coding} coding</span>
            <span className="text-red-600 dark:text-red-300">{summary.errors} errors</span>
            <span className="text-amber-700 dark:text-amber-300">{summary.needsHelp} help</span>
            <span className="text-blue-700 dark:text-blue-300">{summary.submitted} submitted</span>
            <span className="text-emerald-700 dark:text-emerald-300">{summary.approved} approved</span>
          </div>
        ) : null}
      </div>

      {error && !payload ? (
        <div className={cn(chrome.card, "p-4 text-sm text-red-600 dark:text-red-400")}>{error}</div>
      ) : loading && !payload ? (
        <div className={cn(chrome.card, "flex flex-1 items-center justify-center gap-2 p-8 text-sm", PORTAL_TEXT_MUTED)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading live classroom…
        </div>
      ) : (
        <>
          {error ? (
            <div className={cn(chrome.card, "px-4 py-2 text-xs text-amber-700 dark:text-amber-300")}>
              Refresh issue: {error}
            </div>
          ) : null}
          <div
            className={cn(
              "instructor-live-session__grid min-h-0 flex-1",
              runPanelOpen && "instructor-live-session__grid--run-open",
            )}
          >
            <section className={cn(chrome.card, "flex min-h-0 min-w-0 flex-col overflow-hidden p-3")}>
              <div className="mb-2 shrink-0 space-y-2 px-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Students</h3>
                  <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{filteredStudents.length}</span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cc-text-muted)]" />
                  <Input
                    value={studentQuery}
                    onChange={(event) => setStudentQuery(event.target.value)}
                    placeholder="Search students"
                    aria-label="Search students"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {filterButtons.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant={filter === item.id ? "default" : "outline"}
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}
                      {item.count != null ? ` (${item.count})` : ""}
                    </Button>
                  ))}
                </div>
              </div>
              {payload?.blockedJoins?.length ? (
                <div
                  role="status"
                  className="mb-2 shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-200"
                >
                  <p className="font-semibold">
                    {payload.blockedJoins.length === 1
                      ? "1 student couldn't join"
                      : `${payload.blockedJoins.length} students couldn't join`}
                  </p>
                  <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto overscroll-contain">
                    {payload.blockedJoins.map((blocked) => (
                      <li key={blocked.studentDbId} className="line-clamp-1" title={blocked.message}>
                        {blocked.fullName}
                        {blocked.section ? ` (${blocked.section})` : ""} · {blocked.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="instructor-live-session__roster-list scrollbar-themed min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {filteredStudents.length ? (
                  filteredStudents.map((entry) => ( /* roster row */
                    <StudentRowButton
                      key={entry.row.studentDbId}
                      row={entry.row}
                      shownAt={entry.shownAt}
                      faceStatus={entry.faceStatus}
                      faceLabel={entry.faceLabel}
                      errorLines={compilerErrorLines(entry.row, payload?.recentEvents ?? [])}
                      selected={entry.row.studentDbId === selectedStudentId}
                      onSelect={() => setSelectedStudentId(entry.row.studentDbId)}
                    />
                  ))
                ) : (
                  <p className={cn("px-2 py-6 text-center text-sm", PORTAL_TEXT_MUTED)}>
                    {studentQuery.trim()
                      ? "No students match that search."
                      : filter === "all"
                        ? "No students in this section yet."
                        : "No students match this filter."}
                  </p>
                )}
              </div>
              {payload?.recentEvents.length ? (
                <div className="mt-3 shrink-0 border-t border-[var(--border)] pt-3">
                  <p className={cn("mb-2 px-1 text-xs font-semibold", PORTAL_TEXT)}>Recent activity</p>
                  <div className="max-h-28 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                    {payload.recentEvents.slice(0, 12).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--muted)]/40"
                        onClick={() => setSelectedStudentId(event.studentDbId)}
                      >
                        <p className={cn("text-[11px] font-medium", eventToneClass(event.tone))}>
                          {event.studentName} · {event.title}
                        </p>
                        {event.detail ? (
                          <p className="line-clamp-1 text-[10px] text-[var(--cc-text-muted)]">{event.detail}</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className={cn(chrome.card, "flex min-h-0 min-w-0 flex-col overflow-hidden p-4")}>
              {selectedStudent ? (
                <>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{selectedStudent.fullName}</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {selectedStudent.statusLabel}
                        {selectedStudent.score != null ? ` · Score ${selectedStudent.score}` : ""}
                        {selectedStudent.snapshotUpdatedAt
                          ? ` · Updated ${formatWhen(selectedStudent.snapshotUpdatedAt)}`
                          : ""}
                        {!sessionClosed ? " · Use Help edit only when intervening" : ""}
                      </p>
                      {compilerErrorLines(selectedStudent, payload?.recentEvents ?? []).map((line) => (
                        <p key={line} className="mt-1 text-[11px] leading-snug text-red-600 dark:text-red-300">
                          {line}
                        </p>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <StatusFlags row={selectedStudent} />
                    </div>
                  </div>
                  <LiveTypingReplayPanel
                    key={selectedStudent.studentDbId}
                    replay={selectedStudent.typingReplay}
                    liveCode={selectedStudentCode || cloudEditorFile?.code || ""}
                    fileName={selectedStudent.fileName || cloudEditorFile?.fileName || null}
                    language={selectedStudent.language}
                    isLive={isStudentLive}
                    codeSource={isStudentLive ? "live" : selectedCodeSource}
                    hasGradedSubmission={
                      selectedStudent.status === "approved" ||
                      selectedStudent.status === "submitted" ||
                      selectedStudent.status === "review"
                    }
                    replayVersion={`${selectedStudent.studentDbId}:${selectedStudent.typingReplay?.startTime ?? 0}`}
                    className="min-h-0 flex-1"
                    editable={!sessionClosed}
                    sending={pushing}
                    onSendToStudent={handleSendToStudent}
                    onDisplayCodeChange={setDisplayCodeForRun}
                    onRunStudentCode={handleOpenRunPanel}
                    onSyncStudentCode={() => void handleSyncStudentCode()}
                    syncStudentLoading={syncingStudent}
                    runStudentLoading={runLoading}
                    runStudentDisabled={runLoading}
                    studentCursor={selectedStudent.studentCursor}
                  />
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <Users className="h-8 w-8 text-[var(--cc-text-muted)]" />
                  <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Select a student</p>
                  <p className={cn("max-w-sm text-xs", PORTAL_TEXT_MUTED)}>
                    Pick someone from the roster to watch their live code or replay their keystrokes.
                  </p>
                </div>
              )}
            </section>

            {runPanelOpen && selectedStudent ? (
              <LiveInstructorRunPanel
                ref={runPanelRef}
                className="instructor-live-session__run-panel"
                studentName={selectedStudent.fullName}
                onBusyChange={setRunLoading}
                onClose={() => {
                  pendingRunCodeRef.current = null
                  setRunPanelOpen(false)
                }}
                onTerminalReady={handleTerminalReady}
              />
            ) : null}
          </div>
        </>
      )}

      <InstructorClassroomQuestionDrawer
        open={questionOpen}
        onClose={() => setQuestionOpen(false)}
        assignment={handoff}
      />
    </div>
  )
}
