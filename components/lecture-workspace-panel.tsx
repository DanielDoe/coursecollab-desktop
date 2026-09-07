"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  LockOpen,
  PenLine,
  Save,
  Settings2,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CircuitSubmissionFields } from "@/components/circuit-submission-fields"
import { QuestionTextRenderer, ExplanationTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import {
  categoryLabel,
  freeformWorkspaceQuestion,
  groupWorkspaceQuestions,
  lectureWorkspaceQuestionNumericId,
  sectionAllSolutionsUnlocked,
  solutionMarkdownFromQuestion,
  workspaceQuestionHasAuthoredSolution,
  defaultLectureWorkspaceConfig,
  type LectureWorkspaceConfig,
  type LectureWorkspaceQuestion,
} from "@/lib/lecture-workspace"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  LectureWorkspaceConfigFields,
  useLectureWorkspaceConfig,
} from "@/components/lecture-workspace-editor"
import { cn } from "@/lib/utils"
import { useDebouncedCallback } from "@/lib/use-debounced-callback"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CTA, PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { CC_TABS } from "@/lib/appearance/ui-primitives"
import { CoraAskDrawer } from "@/components/cora/CoraAskDrawer"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import { LectureWorkspaceInstructorInkPanel } from "@/components/lecture-workspace-instructor-ink-panel"
import { QuestionPrepareGate } from "@/components/question-prepare-gate"

const lecturesChrome = facultyEmbedChrome("lectures")
const fp = lecturesChrome.p

export type LectureWorkspacePanelMode = "student" | "instructor"

type InstructorPanelTab = "preview" | "configure"

type ContentProps = {
  lectureId: number
  workspaceTitle?: string
  mode?: LectureWorkspacePanelMode
  studentRosterId?: string
  studentDatabaseId?: number | null
  onConfigSaved?: () => void
  lectureTitle?: string
  /** When true, always visible below slides (not in a sheet). */
  embedded?: boolean
  /** Sheet mode: load when open. Embedded: load when active. */
  active?: boolean
}

function emptyAnswerJson(): string {
  return JSON.stringify({
    solution_uploads: {},
    workspace: null,
    submission_mode: "workspace",
  })
}

function WorkspaceQuestionCard({
  question,
  index,
  lectureId,
  expanded,
  onToggleExpand,
  studentRosterId,
  studentDatabaseId,
  isInstructorPreview,
  savedAnswer,
  allowSave,
  onToggleSolutionUnlock,
  solutionLockSaving,
}: {
  question: LectureWorkspaceQuestion
  index: number
  lectureId: number
  expanded: boolean
  onToggleExpand: () => void
  studentRosterId?: string
  studentDatabaseId?: number | null
  isInstructorPreview?: boolean
  savedAnswer?: unknown
  allowSave?: boolean
  onToggleSolutionUnlock?: (unlocked: boolean) => void
  solutionLockSaving?: boolean
}) {
  const restoredAnswer = (() => {
    if (savedAnswer == null) return null
    if (typeof savedAnswer === "string") return savedAnswer
    try {
      return JSON.stringify(savedAnswer)
    } catch {
      return null
    }
  })()

  const [answer, setAnswer] = useState(() => restoredAnswer ?? emptyAnswerJson())
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showSolution, setShowSolution] = useState(true)
  const [coraDrawerOpen, setCoraDrawerOpen] = useState(false)
  const answerRef = useRef(answer)
  answerRef.current = answer

  const numericQuestionId = lectureWorkspaceQuestionNumericId(question.id, index)

  const persistDraft = useCallback(
    async (json: string) => {
      if (isInstructorPreview || !studentRosterId || !allowSave) return
      setSaving(true)
      try {
        let parsed: unknown = json
        try {
          parsed = JSON.parse(json)
        } catch {
          parsed = json
        }
        const res = await studentApiFetch(`/api/student/lectures/${lectureId}/workspace`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: studentRosterId,
            questionId: question.id,
            studentAnswer: parsed,
          }),
        })
        if (res.ok) setSavedAt(new Date().toLocaleTimeString())
      } catch {
        /* ignore autosave errors */
      } finally {
        setSaving(false)
      }
    },
    [isInstructorPreview, studentRosterId, lectureId, question.id, allowSave],
  )

  const debouncedSave = useDebouncedCallback(persistDraft, 1200)

  const handleAnswerChange = (json: string) => {
    setAnswer(json)
    debouncedSave(json)
  }

  const handleManualSave = async () => {
    debouncedSave.flush()
    await persistDraft(answerRef.current)
  }

  const solutionMarkdown = solutionMarkdownFromQuestion(question)
  const hasSolution = solutionMarkdown.trim().length > 0
  const hasAuthoredSolution = isInstructorPreview
    ? workspaceQuestionHasAuthoredSolution(question)
    : question.solution_available === true || hasSolution
  const isUnlocked = isInstructorPreview
    ? question.solution_unlocked === true
    : question.solution_unlocked === true && hasSolution
  const showSolutionContent = isInstructorPreview ? hasSolution : isUnlocked && hasSolution

  return (
    <div className={cn("overflow-hidden rounded-xl shadow-sm", PORTAL_CARD)}>
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--sidebar-accent)]/50"
        onClick={onToggleExpand}
      >
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            fp.iconBg,
            fp.iconText,
          )}
        >
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[var(--cc-text)]">{question.title}</p>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {question.topic?.trim() || categoryLabel(question.category)}
            </Badge>
            {hasAuthoredSolution ? (
              isInstructorPreview ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wide",
                    isUnlocked
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
                  )}
                >
                  {isUnlocked ? "Unlocked" : "Locked"}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wide",
                    isUnlocked
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
                  )}
                >
                  {isUnlocked ? (
                    <>
                      <LockOpen className="mr-1 inline h-3 w-3" />
                      Solution open
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1 inline h-3 w-3" />
                      Solution locked
                    </>
                  )}
                </Badge>
              )
            ) : null}
          </div>
          {!expanded ? (
            <div className="mt-0.5 line-clamp-2 text-sm text-[var(--cc-text-muted)] [&_.question-text-content]:text-inherit [&_.katex]:text-[0.9em]">
              <QuestionTextRenderer text={question.question_text} className="text-sm" />
            </div>
          ) : null}
        </div>
        {expanded ? (
          <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
          <QuestionMediaDisplay
            question={{ question_media: question.question_media }}
            size="medium"
          />

          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4">
            <QuestionTextRenderer
              text={question.question_text}
              className="text-sm leading-relaxed text-[var(--cc-text)]"
            />
          </div>

          {!isInstructorPreview ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant={coraDrawerOpen ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-1.5 rounded-full",
                  coraDrawerOpen
                    ? "border-0 bg-[var(--cc-accent)] text-white hover:opacity-90"
                    : "",
                )}
                onClick={() => setCoraDrawerOpen((open) => !open)}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {coraDrawerOpen ? "Hide Cora" : "Ask Cora"}
              </Button>
              <CoraAskDrawer
                open={coraDrawerOpen}
                onClose={() => setCoraDrawerOpen(false)}
                studentId={studentDatabaseId != null ? String(studentDatabaseId) : null}
                title="Ask Cora"
                subtitle={question.title || "Workspace problem"}
                topOffset="0px"
                problem={coraContextFromQuestion({
                  source: "lecture_workspace",
                  domain: "circuit",
                  title: question.title,
                  topic: question.topic,
                  questionText: question.question_text,
                  questionType: "circuit_submission",
                  mediaUrl: question.question_media?.media_url ?? null,
                  lectureId,
                  questionId: question.id,
                  studentDatabaseId: studentDatabaseId ?? null,
                })}
              />
            </div>
          ) : null}

          <LectureWorkspaceInstructorInkPanel workspace={question.instructor_solution_workspace} />

          {!isInstructorPreview ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--cc-text-muted)]">Your notes (autosave)</p>
              <CircuitSubmissionFields
            question={{
              id: numericQuestionId,
              question_text: question.question_text,
              question_type: "circuit_submission",
              question_media: question.question_media,
              solution_upload_config: question.solution_upload_config,
            }}
            selectedAnswer={answer}
            onAnswerChange={handleAnswerChange}
            attemptId={lectureId}
            questionId={numericQuestionId}
            requireStudentDatabaseId={false}
            hideQuestionHeader
            workspaceOnly
          />
            </div>
          ) : (
            <CircuitSubmissionFields
              question={{
                id: numericQuestionId,
                question_text: question.question_text,
                question_type: "circuit_submission",
                question_media: question.question_media,
                solution_upload_config: question.solution_upload_config,
              }}
              selectedAnswer={answer}
              onAnswerChange={handleAnswerChange}
              attemptId={lectureId}
              questionId={numericQuestionId}
              requireStudentDatabaseId={false}
              hideQuestionHeader
              workspaceOnly
            />
          )}

          {allowSave && !isInstructorPreview ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleManualSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save notes
                  </>
                )}
              </Button>
              {savedAt ? (
                <span className="text-xs text-[var(--cc-accent-dark)]">Saved at {savedAt}</span>
              ) : (
                <span className="text-xs text-[var(--cc-text-muted)]">Notes autosave as you write</span>
              )}
            </div>
          ) : null}

          {hasAuthoredSolution && isInstructorPreview && onToggleSolutionUnlock ? (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                isUnlocked
                  ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  : "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--cc-text)]">
                  {isUnlocked ? "Visible to students" : "Hidden from students"}
                </p>
                <p className="text-xs text-[var(--cc-text-muted)]">
                  {isUnlocked
                    ? "Students can expand the step-by-step solution."
                    : "Students see a locked message until you unlock this solution."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor={`unlock-${question.id}`} className="text-xs text-[var(--cc-text-muted)]">
                  Unlock
                </Label>
                <Switch
                  id={`unlock-${question.id}`}
                  checked={isUnlocked}
                  disabled={solutionLockSaving}
                  onCheckedChange={onToggleSolutionUnlock}
                />
              </div>
            </div>
          ) : null}

          {hasAuthoredSolution && !isInstructorPreview && !isUnlocked ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    Step-by-step solution locked
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                    Work through the problem in the workspace first. Your instructor will unlock the
                    worked solution when the class is ready.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {showSolutionContent ? (
            <div className="space-y-2">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left",
                  fp.softBg,
                  fp.border,
                )}
                onClick={() => setShowSolution((v) => !v)}
              >
                <span className={cn("flex items-center gap-2 text-sm font-semibold", fp.iconText)}>
                  <BookOpenCheck className="h-4 w-4" />
                  Step-by-step solution
                  {!isInstructorPreview && isUnlocked ? (
                    <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                      Unlocked
                    </Badge>
                  ) : null}
                </span>
                {showSolution ? (
                  <ChevronUp className={cn("h-4 w-4", fp.iconText)} />
                ) : (
                  <ChevronDown className={cn("h-4 w-4", fp.iconText)} />
                )}
              </button>
              {showSolution ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <ExplanationTextRenderer text={solutionMarkdown} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function LectureWorkspaceContent({
  lectureId,
  workspaceTitle,
  mode = "student",
  studentRosterId,
  studentDatabaseId,
  onConfigSaved,
  lectureTitle,
  embedded = false,
  active = true,
}: ContentProps) {
  const isInstructorPreview = mode === "instructor"
  const [instructorTab, setInstructorTab] = useState<InstructorPanelTab>("preview")
  const {
    config: instructorConfig,
    setConfig: setInstructorConfig,
    loading: configLoading,
    saving: configSaving,
    save: saveInstructorConfig,
    load: reloadInstructorConfig,
  } = useLectureWorkspaceConfig(lectureId, active && isInstructorPreview)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(workspaceTitle ?? "In-Class Workspace")
  const [questions, setQuestions] = useState<LectureWorkspaceQuestion[]>([])
  const [draftsByQuestion, setDraftsByQuestion] = useState<
    Record<string, { student_answer: unknown; updated_at: string }>
  >({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [instructorFullConfig, setInstructorFullConfig] = useState<LectureWorkspaceConfig | null>(null)
  const [lockSaving, setLockSaving] = useState(false)

  const persistInstructorWorkspace = useCallback(
    async (nextQuestions: LectureWorkspaceQuestion[]) => {
      if (!isInstructorPreview) return false
      const base = instructorFullConfig ?? defaultLectureWorkspaceConfig()
      const nextConfig: LectureWorkspaceConfig = {
        ...base,
        enabled: true,
        title: base.title || title,
        questions: nextQuestions,
      }
      setLockSaving(true)
      try {
        const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/workspace`, {
          method: "PATCH",
          headers: {
            ...buildInstructorApiHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ config: nextConfig }),
        })
        const data = (await res.json()) as { error?: string; config?: LectureWorkspaceConfig }
        if (!res.ok) throw new Error(data.error || "Failed to update solution locks")
        const saved = data.config ?? nextConfig
        setInstructorFullConfig(saved)
        setQuestions(saved.questions)
        setTitle(saved.title?.trim() || title)
        setInstructorConfig(saved)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update solution locks")
        return false
      } finally {
        setLockSaving(false)
      }
    },
    [isInstructorPreview, instructorFullConfig, lectureId, title, setInstructorConfig],
  )

  const setQuestionSolutionUnlock = useCallback(
    async (questionId: string, unlocked: boolean) => {
      const next = questions.map((q) =>
        q.id === questionId ? { ...q, solution_unlocked: unlocked } : q,
      )
      setQuestions(next)
      await persistInstructorWorkspace(next)
    },
    [questions, persistInstructorWorkspace],
  )

  const setSectionSolutionUnlockAll = useCallback(
    async (sectionLabel: string, unlocked: boolean) => {
      const next = questions.map((q) => {
        const label = q.topic?.trim() || categoryLabel(q.category)
        if (label !== sectionLabel || !workspaceQuestionHasAuthoredSolution(q)) return q
        return { ...q, solution_unlocked: unlocked }
      })
      setQuestions(next)
      await persistInstructorWorkspace(next)
    },
    [questions, persistInstructorWorkspace],
  )

  const loadWorkspace = useCallback(async () => {
    if (!active) return
    setLoading(true)
    setError(null)
    try {
      if (isInstructorPreview) {
        const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/workspace`, {
          headers: buildInstructorApiHeaders(),
          cache: "no-store",
        })
        const data = (await res.json()) as {
          config?: {
            enabled?: boolean
            title?: string
            questions?: LectureWorkspaceQuestion[]
          }
          error?: string
        }
        if (!res.ok) throw new Error(data.error || "Failed to load workspace")
        const config = data.config ?? defaultLectureWorkspaceConfig()
        const qs = config.questions ?? []
        setInstructorFullConfig(config)
        setTitle(config.title?.trim() || workspaceTitle || "In-Class Workspace")
        setQuestions(qs)
        setDraftsByQuestion({})
        setExpandedId(qs[0]?.id ?? null)
        return
      }

      if (!studentRosterId) return
      const res = await fetch(
        `/api/student/lectures/${lectureId}/workspace?studentId=${encodeURIComponent(studentRosterId)}`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as {
        enabled?: boolean
        title?: string
        questions?: LectureWorkspaceQuestion[]
        drafts?: Array<{ question_id: string; student_answer: unknown; updated_at: string }>
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Failed to load workspace")
      setTitle(data.title?.trim() || workspaceTitle || "In-Class Workspace")
      setQuestions(Array.isArray(data.questions) ? data.questions : [])
      const draftMap: Record<string, { student_answer: unknown; updated_at: string }> = {}
      for (const d of data.drafts ?? []) {
        draftMap[d.question_id] = { student_answer: d.student_answer, updated_at: d.updated_at }
      }
      setDraftsByQuestion(draftMap)
      if (data.questions?.length) {
        setExpandedId(data.questions[0]?.id ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspace")
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [active, isInstructorPreview, lectureId, studentRosterId, workspaceTitle])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    if (!active || !isInstructorPreview) return
    setInstructorTab("preview")
  }, [active, isInstructorPreview, lectureId])

  const handleInstructorSave = async () => {
    const saved = await saveInstructorConfig()
    if (!saved) return
    onConfigSaved?.()
    await reloadInstructorConfig()
    await loadWorkspace()
    if (saved.questions.length > 0) {
      setInstructorTab("preview")
    }
  }

  const sectionGroups = groupWorkspaceQuestions(questions)

  let globalIndex = 0
  const freeformQuestion = freeformWorkspaceQuestion(lectureTitle ?? title)
  const showFreeformOnly = questions.length === 0 && !loading && !error

  const header = (
    <div
      className={cn(
        "shrink-0 border-b border-[var(--border)] px-4 py-4 sm:px-6",
        embedded && "bg-[var(--card)]/95",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-left text-base font-semibold sm:text-lg text-[var(--cc-text)]">
            <PenLine className={cn("h-5 w-5 shrink-0", fp.iconText)} />
            {title}
          </h2>
          <p className="mt-1 text-left text-xs text-muted-foreground sm:text-sm">
            {isInstructorPreview
              ? "Work problems in class with the ink workspace. Lock step-by-step solutions until students should see them — use Unlock all per section or toggle each problem."
              : "Solve in the ink workspace during class. Step-by-step solutions unlock when your instructor releases them."}
          </p>
        </div>
      </div>
      {isInstructorPreview ? (
        <div className={cn("mt-3 flex gap-1 rounded-lg p-1", CC_TABS.list, "bg-[var(--sidebar-accent)]/50")}>
          <button
            type="button"
            onClick={() => setInstructorTab("preview")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              instructorTab === "preview" ? CC_TABS.trigger : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
            )}
          >
            <BookOpenCheck className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setInstructorTab("configure")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              instructorTab === "configure"
                ? CC_TABS.trigger
                : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configure
          </button>
        </div>
      ) : null}
    </div>
  )

  const prepareTexts = useMemo(
    () =>
      questions.flatMap((q) => [
        q.question_text,
        ...q.step_by_step_solution.content,
      ]),
    [questions],
  )

  const body = (
    <QuestionPrepareGate
      fetching={loading}
      texts={prepareTexts}
      title="Preparing workspace"
      subtitle="Loading problems and math formatting"
      enabled={!isInstructorPreview || instructorTab === "preview"}
    >
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 sm:px-6",
          embedded && "bg-[var(--muted)]/30",
        )}
      >
      {isInstructorPreview && instructorTab === "configure" ? (
        configLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--cc-text-muted)]">
            <Loader2 className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass("lectures"))} />
            <p className="text-sm">Loading configuration…</p>
          </div>
        ) : (
          <LectureWorkspaceConfigFields config={instructorConfig} setConfig={setInstructorConfig} />
        )
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--cc-text-muted)]">
          <Loader2 className={cn("h-5 w-5 animate-spin", facultyModuleSpinnerClass("lectures"))} />
          Loading workspace…
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      ) : showFreeformOnly ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] px-4 py-5 text-center sm:px-6">
            <PenLine className={cn("mx-auto mb-3 h-8 w-8", fp.iconText)} />
            <h3 className="text-base font-semibold text-[var(--cc-text)]">No workspace questions yet</h3>
            <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">
              {isInstructorPreview
                ? "This lecture does not have structured in-class problems configured. Students can still use a freeform scratch workspace during class, or you can add problems under Configure."
                : "This lecture does not have structured workspace problems. Use the scratch area below for in-class notes and sketches."}
            </p>
            {isInstructorPreview ? (
              <button
                type="button"
                onClick={() => setInstructorTab("configure")}
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                  fp.softBg,
                  fp.border,
                  fp.iconText,
                  "border",
                )}
              >
                <Settings2 className="h-4 w-4" />
                Set up workspace questions
              </button>
            ) : null}
          </div>
          <WorkspaceQuestionCard
            question={freeformQuestion}
            index={0}
            lectureId={lectureId}
            expanded
            onToggleExpand={() => {}}
            studentRosterId={studentRosterId}
            studentDatabaseId={studentDatabaseId}
            isInstructorPreview={isInstructorPreview}
            savedAnswer={draftsByQuestion[freeformQuestion.id]?.student_answer}
            allowSave
          />
        </div>
      ) : questions.length === 0 ? null : (
        <div className="space-y-6">
          {sectionGroups.map(({ label, items }) => {
            const sectionHasSolutions = items.some(workspaceQuestionHasAuthoredSolution)
            const allSectionUnlocked = sectionAllSolutionsUnlocked(items)
            return (
            <section key={label || "all"} className="space-y-3">
              {label ? (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-wide text-[var(--cc-text-muted)]">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    {label}
                  </h3>
                  {sectionHasSolutions ? (
                    isInstructorPreview ? (
                      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
                        <Label
                          htmlFor={`unlock-section-${label}`}
                          className="text-xs font-medium text-[var(--cc-text-secondary)]"
                        >
                          Unlock all
                        </Label>
                        <Switch
                          id={`unlock-section-${label}`}
                          checked={allSectionUnlocked}
                          disabled={lockSaving}
                          onCheckedChange={(checked) => void setSectionSolutionUnlockAll(label, checked)}
                        />
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px] uppercase tracking-wide",
                          allSectionUnlocked
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
                        )}
                      >
                        {allSectionUnlocked ? "Solutions unlocked" : "Solutions locked"}
                      </Badge>
                    )
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-3">
                {items.map((q) => {
                  const idx = globalIndex++
                  return (
                    <WorkspaceQuestionCard
                      key={q.id}
                      question={q}
                      index={idx}
                      lectureId={lectureId}
                      expanded={expandedId === q.id}
                      onToggleExpand={() => setExpandedId((prev) => (prev === q.id ? null : q.id))}
                      studentRosterId={studentRosterId}
                      studentDatabaseId={studentDatabaseId}
                      isInstructorPreview={isInstructorPreview}
                      savedAnswer={draftsByQuestion[q.id]?.student_answer}
                      allowSave
                      onToggleSolutionUnlock={
                        isInstructorPreview
                          ? (unlocked) => void setQuestionSolutionUnlock(q.id, unlocked)
                          : undefined
                      }
                      solutionLockSaving={lockSaving}
                    />
                  )
                })}
              </div>
            </section>
            )
          })}
        </div>
      )}
      </div>
    </QuestionPrepareGate>
  )

  const configureFooter =
    isInstructorPreview && instructorTab === "configure" ? (
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3 sm:px-6">
        <Button
          type="button"
          className={cn("w-full", PORTAL_CTA)}
          onClick={() => void handleInstructorSave()}
          disabled={configSaving || configLoading}
        >
          {configSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save workspace
            </>
          )}
        </Button>
      </div>
    ) : null

  if (embedded) {
    return (
      <section className="flex min-h-0 flex-1 flex-col border-t border-[var(--border)]">
        {header}
        {body}
        {configureFooter}
      </section>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {header}
      {body}
      {configureFooter}
    </div>
  )
}

type PanelProps = ContentProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  buttonLabel?: string
}

export function LectureWorkspacePanel({
  open,
  onOpenChange,
  buttonLabel: _buttonLabel,
  ...contentProps
}: PanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Workspace</SheetTitle>
          <SheetDescription>In-class circuit workspace</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <LectureWorkspaceContent {...contentProps} active={open} embedded={false} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

