"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  Search,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { stripCodebenchProbeComments } from "@/lib/codebench-strip-probe-comments"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"
import { useToast } from "@/hooks/use-toast"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"
import {
  LIVE_INSTRUCTOR_SESSION_POLL_MS,
  liveInstructorSelectedKey,
} from "@/lib/codebench-live-timing"

type Props = {
  handoff: InstructorClassroomHandoff
  onBack: () => void
  onOpenInIde: (handoff: InstructorClassroomHandoff) => void
}

const LIVE_WINDOW_MS = 3 * 60 * 1000

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
  faceLabel,
  onSelect,
}: {
  row: LiveClassroomStudentRow
  selected: boolean
  shownAt: string | null
  faceStatus: LiveStudentStatus
  faceLabel: string
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
          <Badge variant="outline" className={cn("text-[10px]", statusTone(faceStatus))}>
            {faceLabel}
          </Badge>
          {row.compileErrors > 0 ? (
            <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-300">
              {row.compileErrors} error{row.compileErrors === 1 ? "" : "s"}
            </Badge>
          ) : null}
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
  const [filter, setFilter] = useState<RosterFilter>("all")
  const [studentQuery, setStudentQuery] = useState("")
  const [pushing, setPushing] = useState(false)
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
      if (event.key === "Escape") setExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [expanded])

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

  const load = useCallback(async (silent = false, showRefresh = false) => {
    if (!silent) setLoading(true)
    else if (showRefresh) setRefreshing(true)
    if (!silent) setError(null)
    try {
      const focus = selectedStudentIdRef.current
      const focusQs = focus != null ? `&studentId=${encodeURIComponent(String(focus))}` : ""
      const res = await instructorApiFetch(
        `/api/instructor/codebench/live-session?assignmentId=${encodeURIComponent(String(handoff.submissionId))}${focusQs}`,
      )
      const parsed = await readInstructorApiJson<LiveClassroomSessionPayload>(res, "Live classroom session")
      if (!parsed.ok) throw new Error(parsed.error)
      setPayload(parsed.data)
      setError(null)
      setSelectedStudentId((prev) => {
        if (prev != null && parsed.data.students.some((s) => s.studentDbId === prev)) return prev
        const priority = parsed.data.students.find((s) =>
          ["needs_help", "error", "coding"].includes(s.status),
        )
        return priority?.studentDbId ?? parsed.data.students[0]?.studentDbId ?? null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load live session"
      if (!silent || !payloadRef.current) setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [handoff.submissionId, scopeKey])

  useEffect(() => {
    void load()
  }, [load])

  useImmediateLivePoll(() => void load(true, false), LIVE_INSTRUCTOR_SESSION_POLL_MS)

  useEffect(() => {
    if (selectedStudentId == null) return
    try {
      sessionStorage.setItem(liveInstructorSelectedKey(handoff.submissionId), String(selectedStudentId))
    } catch {
      /* quota / private mode */
    }
    void load(true, false)
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
      .map((row) => {
        const bucket = rosterBucket(row.status)
        const face =
          bucket === "present"
            ? { status: "joined" as const, label: "Joined" }
            : { status: row.status, label: row.statusLabel }
        return {
          row,
          shownAt: clocks.get(row.studentDbId)?.at ?? row.lastActivityAt,
          faceStatus: face.status,
          faceLabel: face.label,
        }
      })
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

  const resolveRunnableCode = useCallback(() => {
    return stripCodebenchProbeComments((displayCodeForRun || selectedStudentCode || "").trim())
  }, [displayCodeForRun, selectedStudentCode])

  const handleTerminalReady = useCallback(() => {
    const code = pendingRunCodeRef.current
    if (!code) return
    pendingRunCodeRef.current = null
    void runPanelRef.current?.run(code)
  }, [])

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

  const isStudentLive = useMemo(() => {
    if (!selectedStudent?.snapshotUpdatedAt) return false
    return Date.now() - new Date(selectedStudent.snapshotUpdatedAt).getTime() < LIVE_WINDOW_MS
  }, [selectedStudent?.snapshotUpdatedAt, payload?.polledAt])

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
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => void load(true, true)}
              disabled={loading}
              aria-label="Refresh roster"
              title="Refresh roster"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant={expanded ? "default" : "outline"}
              className="h-8 w-8"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Exit expanded live classroom" : "Expand live classroom"}
              aria-pressed={expanded}
              title={expanded ? "Exit expanded view (Esc)" : "Expand students + code view"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => onOpenInIde(handoff)}
              title="Open this assignment in the instructor IDE"
            >
              <Code2 className="mr-1 h-3.5 w-3.5" />
              Open in IDE
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={() => void handleEndSession()}
              disabled={ending}
            >
              {ending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              End session
            </Button>
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
              <div className="instructor-live-session__roster-list scrollbar-themed min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {filteredStudents.length ? (
                  filteredStudents.map((entry) => ( /* roster row */
                    <StudentRowButton
                      key={entry.row.studentDbId}
                      row={entry.row}
                      shownAt={entry.shownAt}
                      faceStatus={entry.faceStatus}
                      faceLabel={entry.faceLabel}
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
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", statusTone(selectedStudent.status))}>
                      {selectedStudent.statusLabel}
                    </Badge>
                  </div>
                  <LiveTypingReplayPanel
                    key={selectedStudent.studentDbId}
                    replay={selectedStudent.typingReplay}
                    liveCode={selectedStudentCode}
                    fileName={selectedStudent.fileName}
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
    </div>
  )
}
