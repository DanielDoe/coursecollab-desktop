"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Settings2,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { QuestionRenderer } from "@/components/question-renderer"
import { QuestionTextRenderer, ExplanationTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import type {
  LectureSamplePracticeEvaluateResult,
  LectureSamplePracticeQuestion,
} from "@/lib/lecture-sample-practice"
import {
  evaluateSamplePracticeQuestion,
} from "@/lib/lecture-sample-practice"
import {
  samplePracticeHasSelection,
  samplePracticeQuestionToRendererRow,
  samplePracticeRestoreSelection,
  samplePracticeSubmitAnswer,
} from "@/lib/sample-practice-quiz-adapter"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  LectureSamplePracticeConfigFields,
  useLectureSamplePracticeConfig,
} from "@/components/lecture-sample-practice-editor"
import { cn } from "@/lib/utils"
import { CoraLauncherButton } from "@/components/cora/CoraLauncherButton"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import { QuestionPrepareGate } from "@/components/question-prepare-gate"

export type LectureSamplePracticePanelMode = "student" | "instructor"

type Props = {
  lectureId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  buttonLabel?: string
  mode?: LectureSamplePracticePanelMode
  studentRosterId?: string
  studentDatabaseId?: number | null
  onConfigSaved?: () => void
}

type InstructorPanelTab = "preview" | "configure"

function QuestionCard({
  question,
  index,
  studentRosterId,
  studentDatabaseId,
  lectureId,
  expanded,
  onToggleExpand,
  savedAttempt,
  isInstructorPreview = false,
}: {
  question: LectureSamplePracticeQuestion
  index: number
  studentRosterId?: string
  studentDatabaseId?: number | null
  lectureId: number
  expanded: boolean
  onToggleExpand: () => void
  savedAttempt?: {
    student_answer: unknown
    result?: LectureSamplePracticeEvaluateResult
  } | null
  isInstructorPreview?: boolean
}) {
  const restoredAnswer = savedAttempt?.student_answer ?? null
  const initialSelection = samplePracticeRestoreSelection(question, restoredAnswer)

  const [selectedAnswer, setSelectedAnswer] = useState(() => initialSelection.selectedAnswer)
  const [selectedMultiAnswers, setSelectedMultiAnswers] = useState(
    () => initialSelection.selectedMultiAnswers,
  )
  const [submitted, setSubmitted] = useState(() => Boolean(savedAttempt?.result))
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<LectureSamplePracticeEvaluateResult | null>(
    () => savedAttempt?.result ?? null,
  )
  const [engagementRecorded, setEngagementRecorded] = useState(() => Boolean(savedAttempt?.result))
  const [error, setError] = useState<string | null>(null)

  const rendererQuestion = useMemo(
    () => samplePracticeQuestionToRendererRow(question),
    [question],
  )

  const submitAnswer = samplePracticeSubmitAnswer(
    question,
    selectedAnswer,
    selectedMultiAnswers,
  )

  const canSubmit =
    samplePracticeHasSelection(question, selectedAnswer, selectedMultiAnswers) &&
    !submitted &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      if (isInstructorPreview) {
        setResult(evaluateSamplePracticeQuestion(question, submitAnswer))
        setEngagementRecorded(false)
        setSubmitted(true)
        return
      }
      if (!studentRosterId) {
        throw new Error("Student session required")
      }
      const res = await studentApiFetch(`/api/student/lectures/${lectureId}/sample-practice/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentRosterId,
          questionId: question.id,
          answer: submitAnswer,
        }),
      })
      const data = (await res.json()) as {
        result?: LectureSamplePracticeEvaluateResult
        engagement?: { recorded?: boolean; pointsSynced?: boolean }
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Could not check your answer")
      setResult(data.result ?? null)
      setEngagementRecorded(data.engagement?.recorded === true)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed")
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    const cleared = samplePracticeRestoreSelection(question, null)
    setSelectedAnswer(cleared.selectedAnswer)
    setSelectedMultiAnswers(cleared.selectedMultiAnswers)
    setSubmitted(false)
    setResult(null)
    setEngagementRecorded(false)
    setError(null)
  }

  const toggleMultiAnswer = (option: string) => {
    const upper = option.toUpperCase()
    setSelectedMultiAnswers((prev) =>
      prev.includes(upper) ? prev.filter((entry) => entry !== upper) : [...prev, upper],
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        submitted && result?.is_mcq_correct
          ? "border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-700/50 dark:bg-emerald-950/20"
          : submitted && !result?.is_mcq_correct
            ? "border-amber-300/80 bg-amber-50/40 dark:border-amber-700/40 dark:bg-amber-950/15"
            : "border-slate-200/80 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]",
      )}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{question.title}</p>
          {question.topic ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{question.topic}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {submitted ? (
            result?.is_mcq_correct ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Correct</Badge>
            ) : (
              <Badge variant="secondary">Review</Badge>
            )
          ) : null}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-slate-200/80 px-4 py-4 dark:border-white/[0.08]">
          <QuestionMediaDisplay question={question} size="medium" />

          <QuestionTextRenderer
            text={question.question_text}
            className="text-sm leading-relaxed text-slate-800 dark:text-slate-100"
          />

          {!isInstructorPreview ? (
            submitted ? (
              <CoraLauncherButton
                label="Walk through with Cora"
                assessmentState="practice"
                problem={coraContextFromQuestion({
                  source: "lecture_practice",
                  title: question.title,
                  topic: question.topic,
                  questionText: question.question_text,
                  questionType: question.question_type,
                  explanation: result?.explanation ?? null,
                  mediaUrl: question.question_media?.media_url ?? null,
                  lectureId,
                  questionId: question.id,
                  studentDatabaseId: studentDatabaseId ?? null,
                })}
              />
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submit your answer first to unlock Cora for this question.
              </p>
            )
          ) : null}

          {rendererQuestion ? (
            <QuestionRenderer
              question={rendererQuestion}
              selectedAnswer={selectedAnswer}
              selectedMultiAnswers={selectedMultiAnswers}
              code=""
              showFeedback={submitted}
              isSubmittingAnswer={submitting}
              isCorrect={result?.is_mcq_correct ?? false}
              partialCreditPoints={
                result ? Math.round(result.mcq_earned_fraction * 100) : null
              }
              onAnswerChange={(answer) => setSelectedAnswer(answer.toUpperCase())}
              onMultiAnswerToggle={toggleMultiAnswer}
              onCodeChange={() => {}}
              isPreviewMode={isInstructorPreview}
              isLocked={submitted}
              answerReview={result?.answerReview ?? null}
            />
          ) : null}

          {submitted && result ? (
            <div className="space-y-3 rounded-lg border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                {result.is_mcq_correct ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600" />
                )}
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {result.is_mcq_correct ? "Correct!" : "Not quite — review the solution below"}
                </p>
              </div>
              {engagementRecorded ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Practice engagement points recorded for this question.
                </p>
              ) : null}
              {result.parts.map((part) => (
                <div key={part.id} className="space-y-2">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Part ({part.id}):{" "}
                    {part.is_correct ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Correct</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        Correct answer:{" "}
                        {Array.isArray(part.correct_answer) ? (
                          part.correct_answer.join(", ")
                        ) : part.correct_answer ? (
                          <QuestionTextRenderer
                            text={part.correct_answer}
                            className="inline text-slate-800 dark:text-slate-100 [&_div]:inline [&_div]:mb-0"
                          />
                        ) : null}
                      </span>
                    )}
                  </p>
                  {part.explanation ? (
                    <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
                      <ExplanationTextRenderer text={part.explanation} />
                    </div>
                  ) : null}
                </div>
              ))}
              {!isInstructorPreview ? null : (
              <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                Try again
              </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : isInstructorPreview ? (
                  "Reveal answer key"
                ) : (
                  "Submit & reveal answer"
                )}
              </Button>
              {!samplePracticeHasSelection(question, selectedAnswer, selectedMultiAnswers) ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select your MCQ answer before submitting.
                </p>
              ) : null}
              {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function LectureSamplePracticePanel({
  lectureId,
  studentRosterId,
  studentDatabaseId,
  open,
  onOpenChange,
  buttonLabel = "Sample Practice",
  mode = "student",
  onConfigSaved,
}: Props) {
  const isInstructorPreview = mode === "instructor"
  const [instructorTab, setInstructorTab] = useState<InstructorPanelTab>("preview")
  const {
    config: instructorConfig,
    setConfig: setInstructorConfig,
    loading: configLoading,
    saving: configSaving,
    save: saveInstructorConfig,
    load: reloadInstructorConfig,
  } = useLectureSamplePracticeConfig(lectureId, open && isInstructorPreview)
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<LectureSamplePracticeQuestion[]>([])
  const [practiceEnabledForStudents, setPracticeEnabledForStudents] = useState(true)
  const [savedAttempts, setSavedAttempts] = useState<
    Array<{
      question_id: string
      student_answer?: unknown
      result?: LectureSamplePracticeEvaluateResult
    }>
  >([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadPractice = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      if (isInstructorPreview) {
        const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/sample-practice`, {
          headers: buildInstructorApiHeaders(),
          cache: "no-store",
        })
        const data = (await res.json()) as {
          config?: { enabled?: boolean; questions?: LectureSamplePracticeQuestion[] }
          error?: string
        }
        if (!res.ok) throw new Error(data.error || "Failed to load practice")
        const config = data.config
        const qs = config?.questions ?? []
        if (!qs.length) {
          setQuestions([])
          setSavedAttempts([])
          setPracticeEnabledForStudents(false)
          setLoadError(null)
          setInstructorTab("configure")
          return
        }
        setPracticeEnabledForStudents(config?.enabled === true)
        setQuestions(qs)
        setSavedAttempts([])
        setExpandedId(qs[0]?.id ?? null)
        return
      }

      if (!studentRosterId) {
        throw new Error("Student session required")
      }
      const res = await fetch(
        `/api/student/lectures/${lectureId}/sample-practice?studentId=${encodeURIComponent(studentRosterId)}`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as {
        enabled?: boolean
        questions?: LectureSamplePracticeQuestion[]
        attempts?: Array<{
          question_id: string
          student_answer?: unknown
          result?: LectureSamplePracticeEvaluateResult
        }>
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Failed to load practice")
      if (!data.enabled || !data.questions?.length) {
        setQuestions([])
        setSavedAttempts([])
        setLoadError("Sample practice is not available for this lecture yet.")
        return
      }
      setQuestions(data.questions)
      setSavedAttempts(data.attempts ?? [])
      const firstUnanswered =
        data.questions.find((q) => !(data.attempts ?? []).some((a) => a.question_id === q.id)) ??
        data.questions[0]
      setExpandedId(firstUnanswered?.id ?? null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load practice")
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [lectureId, studentRosterId, isInstructorPreview])

  useEffect(() => {
    if (open) void loadPractice()
  }, [open, loadPractice])

  useEffect(() => {
    if (!open || !isInstructorPreview) return
    setInstructorTab("preview")
  }, [open, isInstructorPreview, lectureId])

  const handleInstructorSave = async () => {
    const saved = await saveInstructorConfig()
    if (!saved) return
    onConfigSaved?.()
    await reloadInstructorConfig()
    await loadPractice()
    if (saved.questions.length > 0) {
      setInstructorTab("preview")
    }
  }

  const prepareTexts = useMemo(
    () =>
      questions.flatMap((q) => [
        q.question_text,
        q.title,
        ...(q.options?.map((o) => o.text) ?? []),
        q.explanation ?? "",
      ]),
    [questions],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-slate-200/80 px-4 py-4 pr-12 dark:border-white/[0.08]">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            {isInstructorPreview ? "Sample practice" : buttonLabel}
          </SheetTitle>
          <SheetDescription className="text-left">
            {isInstructorPreview
              ? "Preview how students experience practice, or switch to Configure to edit questions."
              : "Work through each example, submit your answer, then reveal the solution — one question at a time."}
          </SheetDescription>
          {isInstructorPreview ? (
            <div className="mt-3 flex gap-1 rounded-lg border border-slate-200/80 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setInstructorTab("preview")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  instructorTab === "preview"
                    ? "bg-white text-indigo-800 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
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
                    ? "bg-white text-indigo-800 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configure
              </button>
            </div>
          ) : null}
        </SheetHeader>

        <QuestionPrepareGate
          fetching={loading}
          texts={prepareTexts}
          title="Preparing sample practice"
          subtitle="Loading questions and math formatting"
          enabled={open && (!isInstructorPreview || instructorTab === "preview")}
        >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4">
          {isInstructorPreview && instructorTab === "configure" ? (
            configLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm">Loading configuration…</p>
              </div>
            ) : (
              <LectureSamplePracticeConfigFields config={instructorConfig} setConfig={setInstructorConfig} />
            )
          ) : (
            <>
              {isInstructorPreview && questions.length > 0 && !practiceEnabledForStudents ? (
                <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100/90">
                  Sample practice is configured but not enabled for students yet. Turn on the toggle in Configure
                  when you are ready to publish.
                </p>
              ) : null}
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className="text-sm">Loading practice questions…</p>
                </div>
              ) : loadError ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
              ) : questions.length === 0 && isInstructorPreview ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No questions yet. Switch to <strong>Configure</strong> to add sample practice for this lecture.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={idx}
                      studentRosterId={studentRosterId}
                      studentDatabaseId={studentDatabaseId}
                      lectureId={lectureId}
                      expanded={expandedId === q.id}
                      onToggleExpand={() => setExpandedId((cur) => (cur === q.id ? null : q.id))}
                      savedAttempt={savedAttempts.find((a) => a.question_id === q.id) ?? null}
                      isInstructorPreview={isInstructorPreview}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        </QuestionPrepareGate>

        {isInstructorPreview && instructorTab === "configure" ? (
          <div className="shrink-0 border-t border-slate-200/80 px-4 py-3 dark:border-white/[0.08]">
            <Button
              type="button"
              className="w-full"
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
                  Save sample practice
                </>
              )}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function LectureSamplePracticeTrigger({
  onClick,
  label = "Sample Practice",
  questionCount,
}: {
  onClick: () => void
  label?: string
  questionCount?: number
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-8 shrink-0 gap-1.5 overflow-visible border-indigo-200 bg-white px-2 text-indigo-800 hover:bg-indigo-50 sm:px-2.5 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-950/60"
    >
      <BookOpenCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap text-xs sm:text-sm">{label}</span>
      {questionCount != null && questionCount > 0 ? (
        <Badge
          variant="secondary"
          className="ml-0.5 h-5 min-w-5 px-1 text-[10px] leading-none bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100"
        >
          {questionCount}
        </Badge>
      ) : null}
    </Button>
  )
}

