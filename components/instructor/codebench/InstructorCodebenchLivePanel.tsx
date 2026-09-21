"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { getInstructorData } from "@/lib/auth"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { useInstructorLiveClassroomSessions } from "@/hooks/use-instructor-live-classroom-sessions"
import {
  classroomAssignmentToHandoff,
  classroomAssignmentTopic,
  classroomAssignmentTopicMeta,
  extractClassroomQuestionText,
  groupClassroomAssignmentsByTopic,
  type InstructorClassroomHandoff,
} from "@/lib/codebench-instructor-classroom"
import { codebenchTopicsPresent } from "@/lib/codebench-course-topics"
import { CodebenchTopicFilterSelect } from "@/components/instructor/codebench/CodebenchTopicFilterSelect"
import {
  CODEBENCH_LIVE_PAGE_SIZE,
  CodebenchListPagination,
  paginateCodebenchList,
} from "@/components/instructor/codebench/CodebenchListPagination"
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
  const [questionSearch, setQuestionSearch] = useState("")
  const [topicFilter, setTopicFilter] = useState("all")
  const [page, setPage] = useState(1)
  const listRef = useRef<HTMLDivElement>(null)
  const [sessionOptions, setSessionOptions] = useState<string[]>(["all"])
  const [formValues, setFormValues] = useState<ClassroomAssignmentFormValues>(() =>
    emptyLiveClassroomAssignmentForm(sessionFilter !== "all" ? sessionFilter : null),
  )

  useEffect(() => {
    setFormValues(emptyLiveClassroomAssignmentForm(sessionFilter !== "all" ? sessionFilter : null))
    setTopicFilter("all")
    setPage(1)
  }, [courseScopeVersion, sessionFilter])

  useEffect(() => {
    setPage(1)
  }, [questionSearch, topicFilter])

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

  const topicOptions = useMemo(
    () => codebenchTopicsPresent(activeCodeChallenges, classroomAssignmentTopicMeta),
    [activeCodeChallenges],
  )

  useEffect(() => {
    if (topicFilter !== "all" && !topicOptions.some((topic) => topic.id === topicFilter)) {
      setTopicFilter("all")
    }
  }, [topicFilter, topicOptions])

  const visibleCodeChallenges = useMemo(() => {
    const q = questionSearch.trim().toLowerCase()
    return activeCodeChallenges.filter((row) => {
      if (topicFilter !== "all" && classroomAssignmentTopicMeta(row).id !== topicFilter) return false
      if (!q) return true
      const haystack = [
        row.title,
        extractClassroomQuestionText(row),
        String(row.session ?? ""),
        classroomAssignmentTopic(row),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [activeCodeChallenges, questionSearch, topicFilter])

  const grouped = useMemo(
    () => groupClassroomAssignmentsByTopic(visibleCodeChallenges),
    [visibleCodeChallenges],
  )

  const paging = useMemo(
    () =>
      paginateCodebenchList(
        grouped.flatMap(([, rows]) => rows),
        page,
        CODEBENCH_LIVE_PAGE_SIZE,
      ),
    [grouped, page],
  )

  const pageGrouped = useMemo(
    () => groupClassroomAssignmentsByTopic(paging.rows),
    [paging.rows],
  )

  const goToPage = useCallback((next: number) => {
    setPage(next)
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

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
      const instructor = getInstructorData()
      if (!instructor?.selectedCourseId) {
        toast({
          title: "Select a course first",
          description: "Pick your course in the top bar so students in that section can see the live classroom.",
          variant: "destructive",
        })
        return
      }
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

  const instructor = getInstructorData()
  const scopeChip = [instructor?.selectedCourseCode, instructor?.selectedSessionCode]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="instructor-challenges-panel flex min-h-0 w-full flex-1 flex-col gap-4 pr-1">
      <div className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Radio className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
            <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Live Coding Classroom</h2>
            {scopeChip ? (
              <Badge variant="outline" className="text-[10px]">
                {scopeChip}
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">
                No course selected
              </Badge>
            )}
          </div>
          <p className={cn("w-full text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
            Create a live session or start one from an existing coding challenge. Students join from CodeBench while
            you monitor keystrokes, compile output, and submissions.
          </p>
          <FacultyIntegratedToolbar
              moduleId="codebench-live"
              embedded
              searchFill
              className="w-full min-w-0"
              search={questionSearch}
              onSearchChange={setQuestionSearch}
              onSearchClear={() => setQuestionSearch("")}
              searchPlaceholder="Search questions…"
              searchResetToken={courseScopeVersion}
              filters={
                <CodebenchTopicFilterSelect
                  value={topicFilter}
                  onChange={setTopicFilter}
                  topics={topicOptions}
                  className="w-[10rem] max-w-[10rem]"
                />
              }
              trailing={
                <>
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
                </>
              }
            />
          {questionSearch.trim() || topicFilter !== "all" ? (
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {visibleCodeChallenges.length} matching{" "}
              {visibleCodeChallenges.length === 1 ? "question" : "questions"}
            </p>
          ) : null}
        </div>
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
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
            {questionSearch.trim() || topicFilter !== "all"
              ? "No questions match that filter"
              : "No live-ready coding assignments"}
          </p>
          <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
            {questionSearch.trim() || topicFilter !== "all"
              ? "Try a different title, prompt, or topic."
              : "Create a live session here, or publish a challenge under Challenges / Classroom Points first."}
          </p>
          {questionSearch.trim() || topicFilter !== "all" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQuestionSearch("")
                setTopicFilter("all")
              }}
            >
              Clear filters
            </Button>
          ) : (
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
          )}
        </div>
      ) : (
        <>
          <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {pageGrouped.map(([topic, rows]) => (
          <section key={topic.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{topic.label}</h3>
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
            ))}
          </div>
          <CodebenchListPagination
            page={paging.page}
            pageSize={CODEBENCH_LIVE_PAGE_SIZE}
            totalItems={paging.total}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  )
}
