"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Code2, Loader2, Plus, Radio, RefreshCw } from "lucide-react"
import {
  ClassroomAssignmentAvailabilityFields,
  ClassroomAssignmentFormFields,
  type ClassroomAssignmentFormValues,
} from "@/components/classroom-assignment-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  invalidateInstructorClassroomAssignmentsCache,
  useInstructorClassroomAssignments,
} from "@/hooks/use-instructor-classroom-assignments"
import {
  INSTRUCTOR_CLASSROOM_ASSIGNMENTS_CHANGED,
  notifyInstructorClassroomAssignmentsChanged,
} from "@/lib/instructor-classroom-assignments-changed"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { defaultFacultySessionFilter } from "@/hooks/use-instructor-scope-key"
import { useInstructorLiveClassroomSessions } from "@/hooks/use-instructor-live-classroom-sessions"
import {
  classroomAssignmentToHandoff,
  classroomAssignmentTopic,
  extractClassroomQuestionText,
  groupClassroomAssignmentsBySession,
  type InstructorClassroomHandoff,
} from "@/lib/codebench-instructor-classroom"
import {
  createInstructorCodingChallenge,
  emptyLiveClassroomAssignmentForm,
  validateCodingChallengeForm,
} from "@/lib/instructor-create-coding-challenge-client"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { InstructorClassroomAssignmentActions } from "@/components/instructor/InstructorClassroomAssignmentActions"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  onStartLiveSession: (handoff: InstructorClassroomHandoff) => void
  onOpenClassroomInIde: (handoff: InstructorClassroomHandoff) => void
  onOpenChallenges?: () => void
}

function questionPreview(text: string, max = 140) {
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max).trim()}…`
}

export function InstructorCodebenchLivePanel({
  onStartLiveSession,
  onOpenClassroomInIde,
  onOpenChallenges,
}: Props) {
  const chrome = facultyEmbedChrome("codebench")
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const sessionFilter = useMemo(() => defaultFacultySessionFilter(), [courseScopeVersion])
  const { submissions, loading, error, reload } = useInstructorClassroomAssignments(sessionFilter)
  const {
    sessions: openSessions,
    loading: sessionsLoading,
    reload: reloadSessions,
  } = useInstructorLiveClassroomSessions()
  const [startingId, setStartingId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [startLiveAfterCreate, setStartLiveAfterCreate] = useState(true)
  const [sessionOptions, setSessionOptions] = useState<string[]>(["all"])
  const [formValues, setFormValues] = useState<ClassroomAssignmentFormValues>(() =>
    emptyLiveClassroomAssignmentForm(sessionFilter !== "all" ? sessionFilter : null),
  )

  useEffect(() => {
    setFormValues(emptyLiveClassroomAssignmentForm(sessionFilter !== "all" ? sessionFilter : null))
  }, [courseScopeVersion, sessionFilter])

  useEffect(() => {
    void (async () => {
      try {
        const response = await instructorApiFetch("/api/instructor/sessions", {
          headers: buildInstructorAuthorizedApiHeaders(),
        })
        if (!response.ok) return
        const data = (await response.json()) as { sessions?: Array<{ code?: string }> }
        const codes = [
          ...new Set((data.sessions?.map((entry) => entry.code).filter(Boolean) as string[]) ?? []),
        ]
        setSessionOptions(["all", ...codes])
      } catch {
        setSessionOptions(["all"])
      }
    })()
  }, [courseScopeVersion])

  useEffect(() => {
    const onAssignmentsChanged = () => {
      invalidateInstructorClassroomAssignmentsCache()
      void reload()
      void reloadSessions(true)
    }
    window.addEventListener(INSTRUCTOR_CLASSROOM_ASSIGNMENTS_CHANGED, onAssignmentsChanged)
    return () => window.removeEventListener(INSTRUCTOR_CLASSROOM_ASSIGNMENTS_CHANGED, onAssignmentsChanged)
  }, [reload, reloadSessions])

  const activeCodeChallenges = useMemo(
    () =>
      submissions.filter(
        (row) =>
          row.is_active &&
          String(row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE).toLowerCase() ===
            CLASSROOM_SUBMISSION_KIND_CODE,
      ),
    [submissions],
  )

  const grouped = useMemo(
    () => groupClassroomAssignmentsBySession(activeCodeChallenges),
    [activeCodeChallenges],
  )

  const liveAssignmentIds = useMemo(
    () => new Set(openSessions.map((session) => session.assignmentId)),
    [openSessions],
  )

  const handleRefresh = () => {
    void reload()
    void reloadSessions()
  }

  const handleStart = useCallback(
    async (handoff: InstructorClassroomHandoff) => {
      setStartingId(handoff.submissionId)
      try {
        const response = await instructorApiFetch("/api/instructor/codebench/live-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId: handoff.submissionId }),
        })
        if (response.status !== 404 && response.status !== 405) {
          const parsed = await readInstructorApiJson(response, "Start live session")
          if (!parsed.ok) throw new Error(parsed.error)
          void reloadSessions(true)
        }
        onStartLiveSession(handoff)
      } catch (err) {
        toast({
          title: "Could not start live session",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        })
      } finally {
        setStartingId(null)
      }
    },
    [onStartLiveSession, reloadSessions, toast],
  )

  const handleCreateLiveSession = useCallback(async () => {
    const validationError = validateCodingChallengeForm(formValues)
    if (validationError) {
      toast({
        title: "Complete the form",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    if (!formValues.session?.trim() && sessionFilter === "all") {
      toast({
        title: "Section required",
        description: "Choose which section this live session is for.",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      const created = await createInstructorCodingChallenge({
        formValues,
        sendNotifications: false,
      })
      invalidateInstructorClassroomAssignmentsCache()
      await reload()
      notifyInstructorClassroomAssignmentsChanged()
      const handoff = classroomAssignmentToHandoff(created)
      toast({
        title: "Live classroom assignment created",
        description: startLiveAfterCreate
          ? "Starting the live session…"
          : "Students can join when you start the session from the list below.",
      })
      setShowCreate(false)
      setFormValues(emptyLiveClassroomAssignmentForm(sessionFilter !== "all" ? sessionFilter : null))
      if (startLiveAfterCreate) {
        await handleStart(handoff)
      } else {
        void reloadSessions(true)
      }
    } catch (err) {
      toast({
        title: "Could not create live session",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }, [formValues, handleStart, reload, reloadSessions, sessionFilter, startLiveAfterCreate, toast])

  return (
    <div className="instructor-challenges-panel flex min-h-0 w-full flex-col gap-4 pr-1">
      <div className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
              <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Live Coding Classroom</h2>
            </div>
            <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
              Create a live session or start one from an existing coding challenge. Students join from CodeBench while
              you monitor keystrokes, compile output, and submissions.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleRefresh} disabled={loading || sessionsLoading}>
              {loading || sessionsLoading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => setShowCreate((value) => !value)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {showCreate ? "Cancel" : "New live session"}
            </Button>
          </div>
        </div>

        <ol className={cn("instructor-steps-grid text-xs", PORTAL_TEXT_MUTED)}>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">1. Set up</span> — create or pick a coding assignment
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">2. Start live</span> — students see a join banner in CodeBench
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
            <span className="font-semibold text-[var(--cc-text)]">3. Monitor</span> — watch live code and keystroke replay
          </li>
        </ol>
      </div>

      {showCreate ? (
        <div className={cn(chrome.card, "space-y-5 p-4 sm:p-5")}>
          <div>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>New live classroom session</p>
            <p className={cn("mt-1 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
              This publishes a coding assignment for your section and optionally starts the live session immediately.
              Students do not need Classroom Points open — they join from CodeBench.
            </p>
          </div>

          <ClassroomAssignmentFormFields
            values={{ ...formValues, submissionKind: CLASSROOM_SUBMISSION_KIND_CODE }}
            onChange={(next) => setFormValues({ ...next, submissionKind: CLASSROOM_SUBMISSION_KIND_CODE })}
            showKindSelector={false}
          />

          <ClassroomAssignmentAvailabilityFields
            values={formValues}
            onChange={setFormValues}
            sessions={sessionOptions}
          />

          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-3">
            <Checkbox
              id="live-start-immediately"
              checked={startLiveAfterCreate}
              onCheckedChange={(checked) => setStartLiveAfterCreate(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="live-start-immediately" className={cn("text-sm font-medium", PORTAL_TEXT)}>
                Start live session right after creating
              </Label>
              <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                Opens the instructor monitor view and shows the join banner to students in the selected section.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleCreateLiveSession()} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Radio className="mr-1 h-4 w-4" />}
              {startLiveAfterCreate ? "Create & start live" : "Create assignment"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className={cn(chrome.card, "p-4 text-sm text-red-600 dark:text-red-400")}>{error}</div>
      ) : loading ? (
        <div className={cn(chrome.card, "flex items-center gap-2 p-6 text-sm", PORTAL_TEXT_MUTED)}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading active challenges…
        </div>
      ) : grouped.length === 0 ? (
        <div className={cn(chrome.card, "space-y-3 p-6 text-center")}>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No live-ready coding assignments</p>
          <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
            Create a live session here, or publish a challenge under Challenges / Classroom Points first.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New live session
            </Button>
            {onOpenChallenges ? (
              <Button type="button" size="sm" variant="outline" onClick={onOpenChallenges}>
                Open Challenges
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/faculty/dashboard/assessments/classroom-points">
                Classroom Points
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        grouped.map(([session, rows]) => (
          <section key={session} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{session}</h3>
              <Badge variant="outline" className="text-[10px]">
                {rows.filter((row) => liveAssignmentIds.has(row.id)).length || rows.length}{" "}
                {rows.some((row) => liveAssignmentIds.has(row.id)) ? "live" : "ready"}
              </Badge>
            </div>
            <div className="instructor-challenges-grid grid grid-cols-1 gap-3">
              {rows.map((row) => {
                const handoff = classroomAssignmentToHandoff(row)
                const preview = questionPreview(extractClassroomQuestionText(row))
                const isLive = liveAssignmentIds.has(row.id)
                const starting = startingId === row.id
                return (
                  <article key={row.id} className={cn(chrome.card, "instructor-lift-card flex flex-col gap-3 p-4")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className={cn("text-sm font-semibold leading-snug", PORTAL_TEXT)}>{row.title}</p>
                        <p className={cn("line-clamp-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{preview}</p>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <InstructorClassroomAssignmentActions
                          submission={row}
                          sessions={sessionOptions}
                          onMutated={() => {
                            void reload()
                            void reloadSessions(true)
                          }}
                        />
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))] text-[var(--cc-accent)]">
                          <Code2 className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isLive ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Live now
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Ready
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {classroomAssignmentTopic(row)}
                      </Badge>
                    </div>
                    <div className="mt-auto grid w-full grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full min-w-0 px-2 text-xs sm:text-sm"
                        onClick={() => void handleStart(handoff)}
                        disabled={starting}
                      >
                        {starting ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Radio className="mr-1 h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{isLive ? "Open live session" : "Start live session"}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 w-full min-w-0 bg-[var(--card)] px-2 text-xs shadow-sm sm:text-sm",
                          chrome.outline,
                        )}
                        onClick={() => onOpenClassroomInIde(handoff)}
                      >
                        Open in IDE
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
