"use client"

import { useMemo, useCallback, useState } from "react"
import { Check, ChevronRight, ListOrdered, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { StudentSolutionUpload } from "@/components/student-solution-upload"
import {
  type SolutionUploadAttachment,
  getSolutionUploadAttachmentsForPart,
  parseQuestionSolutionUploadConfig,
  setSolutionUploadAttachmentsForPart,
} from "@/lib/solution-upload"
import {
  emptyMultiPartAnswer,
  getGradableSubquestions,
  parseMultiPartStudentAnswer,
  subquestionOptionLabels,
  type MultiPartStudentAnswer,
} from "@/lib/multi-part-question"
import { isGenericSamplePracticePartPrompt } from "@/lib/lecture-sample-practice"
import {
  SOLUTION_UPLOAD_PART_KEY,
  STANDARD_SOLUTION_UPLOAD_PROMPT,
  deriveMultiPartGradingPolicy,
  usesStandardMultiPartGradingPolicy,
} from "@/lib/multi-part-grading-policy"
import {
  allGuidedPartsVerified,
  checkGuidedPartAnswer,
  guidedMultiPartActiveIndex,
  isGuidedPartVerified,
  isGuidedPartVisible,
  parseGuidedMultiPartConfig,
} from "@/lib/guided-multi-part"

export function MultiPartQuestionFields({
  subquestionsRaw,
  solutionUploadConfigRaw,
  selectedAnswer,
  onAnswerChange,
  disabled,
  locked,
  showFeedback,
  attemptId,
  questionId,
  studentDatabaseId,
  enableSolutionUpload = true,
  onAntiCheatSuspendChange,
  uploadEndpoint,
  uploadHeaders,
  requireStudentDatabaseId = true,
  /** When set, suppresses redundant sub-question prompt text that duplicates the stem. */
  stemText,
}: {
  subquestionsRaw: unknown
  solutionUploadConfigRaw?: unknown
  selectedAnswer: string
  onAnswerChange: (json: string) => void
  disabled?: boolean
  locked?: boolean
  showFeedback?: boolean
  attemptId?: number | null
  questionId?: number | null
  studentDatabaseId?: number | null
  /** When false, hides solution upload (e.g. in-class lecture sample practice). */
  enableSolutionUpload?: boolean
  onAntiCheatSuspendChange?: (suspended: boolean) => void
  uploadEndpoint?: string
  uploadHeaders?: Record<string, string>
  requireStudentDatabaseId?: boolean
  stemText?: string | null
}) {
  const subquestions = useMemo(() => getGradableSubquestions(subquestionsRaw), [subquestionsRaw])
  const uploadCfg = useMemo(
    () => parseQuestionSolutionUploadConfig(solutionUploadConfigRaw),
    [solutionUploadConfigRaw],
  )
  const standardPolicy =
    enableSolutionUpload && usesStandardMultiPartGradingPolicy(solutionUploadConfigRaw, "multi_part")
  const gradingPolicy = useMemo(
    () => deriveMultiPartGradingPolicy(subquestionsRaw, solutionUploadConfigRaw),
    [subquestionsRaw, solutionUploadConfigRaw],
  )
  const offersSolutionUpload =
    enableSolutionUpload &&
    (standardPolicy ||
      uploadCfg.enabled ||
      uploadCfg.require_solution_upload === true ||
      subquestions.some((sq) => sq.allow_solution_upload === true))
  const uploadLabel =
    uploadCfg.label?.trim() || STANDARD_SOLUTION_UPLOAD_PROMPT
  const dl = disabled || locked
  const guided = useMemo(
    () => parseGuidedMultiPartConfig(solutionUploadConfigRaw),
    [solutionUploadConfigRaw],
  )
  const [partCheckFeedback, setPartCheckFeedback] = useState<Record<string, string>>({})

  const merged = useMemo(() => {
    return parseMultiPartStudentAnswer(selectedAnswer || "{}", subquestions)
  }, [selectedAnswer, subquestions])

  const verifiedPartIds = merged.guided_verified ?? []
  const activeStepIndex = guided.enabled
    ? guidedMultiPartActiveIndex(subquestions, verifiedPartIds, guided)
    : subquestions.length
  const revealAllParts = showFeedback || locked

  const sync = useCallback(
    (next: MultiPartStudentAnswer) => {
      onAnswerChange(JSON.stringify(next))
    },
    [onAnswerChange],
  )

  const markPartVerified = useCallback(
    (partId: string) => {
      const nextVerified = verifiedPartIds.includes(partId)
        ? verifiedPartIds
        : [...verifiedPartIds, partId]
      sync({
        version: 1,
        parts: merged.parts,
        solution_uploads: merged.solution_uploads,
        guided_verified: nextVerified,
      })
      setPartCheckFeedback((prev) => {
        const copy = { ...prev }
        delete copy[partId]
        return copy
      })
    },
    [merged.parts, merged.solution_uploads, sync, verifiedPartIds],
  )

  const handleCheckStep = useCallback(
    (partId: string) => {
      const sq = subquestions.find((s) => s.id === partId)
      if (!sq) return
      const result = checkGuidedPartAnswer(sq, merged.parts[partId])
      if (result.ok) {
        markPartVerified(partId)
        return
      }
      setPartCheckFeedback((prev) => ({
        ...prev,
        [partId]: result.feedback ?? "Try again.",
      }))
    },
    [markPartVerified, merged.parts, subquestions],
  )

  const setUploads = (partKey: string, attachments: SolutionUploadAttachment[]) => {
    const uploads = setSolutionUploadAttachmentsForPart(
      { ...(merged.solution_uploads ?? {}) },
      partKey,
      attachments,
    )
    sync({
      version: 1,
      parts: merged.parts,
      solution_uploads: Object.keys(uploads).length > 0 ? uploads : undefined,
      guided_verified: merged.guided_verified,
    })
  }

  if (subquestions.length === 0) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        This multi-part question has no sub-questions configured yet.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {guided.enabled ? (
        <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/25 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ListOrdered className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                Guided workflow — complete each step before the next unlocks
              </p>
              {guided.methodSummary ? (
                <p className="text-xs sm:text-sm text-indigo-800/90 dark:text-indigo-200/90 leading-relaxed">
                  {guided.methodSummary}
                </p>
              ) : (
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                  Work through the steps in order. Check each step before moving on.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {subquestions.map((sq, idx) => {
              const done = isGuidedPartVerified(sq.id, verifiedPartIds)
              const current = idx === activeStepIndex && !revealAllParts
              return (
                <span
                  key={sq.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border",
                    done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : current
                        ? "border-indigo-400 bg-white text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-100"
                        : "border-slate-200 bg-white/60 text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : null}
                  Step {idx + 1}
                </span>
              )
            })}
          </div>
        </div>
      ) : null}

      {subquestions.map((sq, sqIdx) => {
        if (!isGuidedPartVisible(sqIdx, subquestions, verifiedPartIds, guided, revealAllParts)) {
          return null
        }

        const labels = subquestionOptionLabels(sq)
        const partId = sq.id
        const isSelectAll = sq.type === "select_all"
        const current = merged.parts[partId]
        const selectedLetters = isSelectAll
          ? (Array.isArray(current) ? current : []).map((x) => String(x).toUpperCase())
          : [String(current ?? "").toUpperCase()].filter(Boolean)
        const stepVerified = isGuidedPartVerified(partId, verifiedPartIds)
        const isActiveStep = guided.enabled && sqIdx === activeStepIndex && !revealAllParts
        const checkFeedback = partCheckFeedback[partId]
        const stemNorm = (stemText ?? "").trim().toLowerCase().replace(/\s+/g, " ")
        const promptNorm = sq.prompt.trim().toLowerCase().replace(/\s+/g, " ")
        const showPartPrompt =
          sq.prompt.trim().length > 0 &&
          promptNorm !== stemNorm &&
          !isGenericSamplePracticePartPrompt(sq.prompt, sq.type)

        return (
          <div
            key={partId}
            className={cn(
              "rounded-xl border p-4 sm:p-5 space-y-3 bg-white/60 dark:bg-slate-900/30",
              stepVerified
                ? "border-emerald-200/80 dark:border-emerald-800/60"
                : isActiveStep
                  ? "border-indigo-300/90 dark:border-indigo-600 ring-1 ring-indigo-200/60 dark:ring-indigo-800/40"
                  : "border-slate-200/80 dark:border-slate-600",
            )}
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 text-xs font-bold px-1.5">
                {guided.enabled ? sqIdx + 1 : partId}
              </span>
              <div className="min-w-0 space-y-1">
                {guided.enabled ? (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    Step {sqIdx + 1} of {subquestions.length}
                  </p>
                ) : null}
                {showPartPrompt ? (
                  <QuestionTextRenderer
                    text={sq.prompt}
                    className="text-sm sm:text-base font-medium leading-relaxed text-slate-800 dark:text-slate-100"
                  />
                ) : null}
                {sq.step_hint ? (
                  <p className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                    <span>{sq.step_hint}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <ul className="space-y-2">
              {labels.map(({ letter, text }) => {
                const isSelected = selectedLetters.includes(letter.toUpperCase())
                const isCorrect =
                  showFeedback &&
                  (isSelectAll
                    ? (sq.correct_answers ?? []).map((x) => x.toUpperCase()).includes(letter.toUpperCase())
                    : sq.correct_answer?.toUpperCase() === letter.toUpperCase())

                const toggleOption = () => {
                  if (dl || showFeedback) return
                  const parts = { ...merged.parts }
                  if (isSelectAll) {
                    const prev = Array.isArray(parts[partId])
                      ? [...(parts[partId] as string[])]
                      : []
                    const upper = letter.toUpperCase()
                    const next = prev.map((x) => x.toUpperCase()).includes(upper)
                      ? prev.filter((x) => x.toUpperCase() !== upper)
                      : [...prev, upper]
                    parts[partId] = next
                  } else {
                    parts[partId] = letter.toUpperCase()
                  }
                  sync({
                    version: 1,
                    parts,
                    solution_uploads: merged.solution_uploads,
                    guided_verified: merged.guided_verified,
                  })
                }

                return (
                  <li key={letter}>
                    <div
                      role="button"
                      tabIndex={dl || showFeedback ? -1 : 0}
                      aria-disabled={dl || showFeedback}
                      onKeyDown={(e) => {
                        if (dl || showFeedback) return
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleOption()
                        }
                      }}
                      onClick={toggleOption}
                      className={cn(
                        "w-full flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors",
                        dl || showFeedback ? "cursor-default opacity-90" : "cursor-pointer",
                        isCorrect
                          ? "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/30"
                          : isSelected
                            ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/25"
                            : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500",
                      )}
                    >
                      {isSelectAll ? (
                        <span
                          aria-hidden
                          className={cn(
                            "shrink-0 mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center",
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900",
                          )}
                        >
                          {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300",
                          )}
                        >
                          {letter}
                        </span>
                      )}
                      {!isSelectAll && (
                        <span className="shrink-0 font-bold text-slate-600 dark:text-slate-300 w-5">
                          {letter}.
                        </span>
                      )}
                      <QuestionTextRenderer
                        text={text}
                        className="flex-1 min-w-0 text-sm leading-relaxed text-slate-800 dark:text-slate-100 [&_div]:mb-0"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>

            {guided.enabled && isActiveStep && !stepVerified ? (
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full gap-1.5"
                  disabled={dl || selectedLetters.length === 0}
                  onClick={() => handleCheckStep(partId)}
                >
                  Check step
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {checkFeedback ? (
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-2 leading-relaxed">
                    {checkFeedback}
                  </p>
                ) : null}
              </div>
            ) : null}

            {guided.enabled && stepVerified && !revealAllParts ? (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Step complete — continue to the next part.
              </p>
            ) : null}

            {sqIdx < subquestions.length - 1 && isGuidedPartVisible(sqIdx + 1, subquestions, verifiedPartIds, guided, revealAllParts) ? (
              <div className="border-t border-dashed border-slate-200/80 dark:border-slate-600/80 pt-1" />
            ) : null}
          </div>
        )
      })}

      {guided.enabled && !allGuidedPartsVerified(subquestionsRaw, verifiedPartIds, guided) && !revealAllParts ? (
        <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
          Complete and check each step above before submitting the full question.
        </p>
      ) : null}

      {offersSolutionUpload && (!guided.enabled || allGuidedPartsVerified(subquestionsRaw, verifiedPartIds, guided) || revealAllParts) ? (
        <div className="rounded-xl border-2 border-indigo-200/80 dark:border-indigo-800/60 p-4 sm:p-5 space-y-3 bg-indigo-50/40 dark:bg-indigo-950/20">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Solution upload — optional ({gradingPolicy.upload_total_points} pts max — instructor graded)
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {uploadLabel} You may submit without uploading, but you will not earn upload points.
            </p>
          </div>
          <StudentSolutionUpload
            partId={SOLUTION_UPLOAD_PART_KEY}
            label="Upload your complete worked solution"
            multiple
            attachments={getSolutionUploadAttachmentsForPart(
              merged.solution_uploads,
              SOLUTION_UPLOAD_PART_KEY,
            )}
            onAttachmentsChange={(atts) => setUploads(SOLUTION_UPLOAD_PART_KEY, atts)}
            disabled={disabled}
            locked={locked}
            attemptId={attemptId}
            questionId={questionId}
            studentDatabaseId={studentDatabaseId}
            hint="Include derivations, equations, and steps. Add multiple images if your solution spans more than one page."
            onAntiCheatSuspendChange={onAntiCheatSuspendChange}
            uploadEndpoint={uploadEndpoint}
            uploadHeaders={uploadHeaders}
            requireStudentDatabaseId={requireStudentDatabaseId}
          />
        </div>
      ) : null}
    </div>
  )
}
