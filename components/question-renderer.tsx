"use client"

import type React from "react"

import { useEffect, useRef, useState, memo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, XCircle, GripVertical, Lock } from "lucide-react"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { AiFeedbackMarkdown } from "@/components/ai-feedback-markdown"
import { isQuizMcqOptionCorrect } from "@/lib/question-bank-preview"
import { formatEngineeringQuestionText } from "@/lib/engineering-question-text"
import { PlotUpload } from "@/components/plot-upload"
import { motion } from "framer-motion"
import { queueEvent } from "@/lib/observability"
import { useGeminiDetector } from "@/hooks/use-gemini-detector"
import { isBrowserAiEnforcementPlatform } from "@/lib/device-utils"
import { CircuitQuestionFields } from "@/components/circuit-question-fields"
import { CircuitSubmissionFields } from "@/components/circuit-submission-fields"
import { CircuitProvisionalStudentNotice } from "@/components/circuit-provisional-student-notice"
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge"
import {
  isCircuitEvalProvisionalFeedback,
  resolveCircuitEvalDisplayPoints,
} from "@/lib/circuit-submission"
import { MultiPartQuestionFields } from "@/components/multi-part-question-fields"
import { StudentSolutionUpload } from "@/components/student-solution-upload"
import {
  parseQuestionSolutionUploadConfig,
  questionSolutionUploadEnabled,
  unwrapStudentAnswerForGrading,
  ROOT_SOLUTION_PART_KEY,
  type SolutionUploadsMap,
  type SolutionUploadAttachment,
} from "@/lib/solution-upload"
import type { PracticeAnswerReview } from "@/lib/practice-answer-review"
import { resolveSelectAllCorrectLetters } from "@/lib/practice-answer-review"
import { PracticeAnswerReviewBanner } from "@/components/practice-answer-review-banner"

import { QuizAssessmentMonacoEditor } from "@/components/quiz-assessment-monaco-editor"

function FeedbackMarkdown({ text, className = "text-sm" }: { text: string; className?: string }) {
  if (!text?.trim()) return null
  return <AiFeedbackMarkdown text={text} className={className} />
}

import { cn } from "@/lib/utils"

function parseMultiPartMcqSummary(feedback?: string): string | null {
  if (!feedback) return null
  const mcqMatch = feedback.match(/^MCQ:[^\n]+/)
  return mcqMatch ? mcqMatch[0] : null
}

const FEEDBACK_SECTION_TITLE = "text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2"

/** Keeps MCQ / T-F / select-all options readable on ultrawide fullscreen layouts. */
const QUIZ_OBJECTIVE_SHELL = "mx-auto w-full max-w-2xl"

// Extracted to prevent re-creation on parent re-renders (fixes flashing for code_write)
const AIFeedbackDisplay = memo(function AIFeedbackDisplay({
  showFeedback,
  aiFeedback,
  sampleAnswers,
  questionType: questionTypeProp,
}: {
  showFeedback: boolean
  questionType?: string
  aiFeedback?: {
    score?: number
    feedback?: string
    pointsEarned?: number
    maxPoints?: number
    criteria?: { correctness: number; codeQuality: number; efficiency: number; completeness: number }
    suggestions?: string[]
    detailedExplanation?: string
    gradeBreakdown?: { reasoning?: string; strengths?: string[]; weaknesses?: string[]; improvements?: string[] }
    scoreBreakdown?: {
      criteriaScores?: Record<string, number>
      rawScore?: number
      suspiciousTypingPenalty?: number
      penaltyReason?: string
      finalScore?: number
    }
    itemizedIssues?: { issue: string; location: string; fix: string }[]
    aiGraded?: boolean
    requiresManualReview?: boolean
    provisionalScore?: boolean
    requiresInstructorApproval?: boolean
    totalScorePreview?: number
    totalScore?: number
    questionType?: string
    uploadPending?: boolean
    solutionFeedback?: string
    strengths?: string[]
    improvements?: string[]
    partNotes?: { partId: string; notes: string }[]
    aiFeedback?: {
      questionType?: string
      uploadPending?: boolean
      feedback?: string
      strengths?: string[]
      improvements?: string[]
      partNotes?: { partId: string; notes: string }[]
    }
  }
  sampleAnswers?: Array<{ approach: string; description: string; code: string }>
}) {
  // Hooks must be called unconditionally (Rules of Hooks)
  const qtEarly = (questionTypeProp || aiFeedback?.questionType || aiFeedback?.aiFeedback?.questionType || "")
    .toString()
    .toLowerCase()
  const isCircuitSubmission = qtEarly === "circuit_submission"
  const isAIGraded = aiFeedback?.aiGraded === true
  const isPersistentFeedback = isAIGraded || isCircuitSubmission || aiFeedback?.requiresManualReview === true
  const [remainingMs, setRemainingMs] = useState(isPersistentFeedback ? null : 15000)

  useEffect(() => {
    if (!aiFeedback || isPersistentFeedback) return
    const started = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - started
      const left = Math.max(0, 15000 - elapsed)
      setRemainingMs(left)
      if (left === 0) {
        try { window.dispatchEvent(new CustomEvent('cc-feedback-close')) } catch {}
        clearInterval(tick)
      }
    }, 250)
    return () => clearInterval(tick)
  }, [isPersistentFeedback, aiFeedback])

  if (!showFeedback || !aiFeedback) return null

  const nested = aiFeedback.aiFeedback ?? {}
  const qt = (questionTypeProp || aiFeedback.questionType || nested.questionType || "").toLowerCase()
  const isMultiPart =
    qt === "multi_part" ||
    (Array.isArray(aiFeedback.partNotes) && aiFeedback.partNotes.length > 0) ||
    ((Array.isArray(aiFeedback.strengths) && aiFeedback.strengths.length > 0) ||
      (Array.isArray(aiFeedback.improvements) && aiFeedback.improvements.length > 0))
  const uploadPending = aiFeedback.uploadPending ?? nested.uploadPending
  const solutionFeedback =
    aiFeedback.solutionFeedback ?? nested.feedback ?? aiFeedback.feedback ?? ""
  const strengths = aiFeedback.strengths ?? nested.strengths ?? aiFeedback.gradeBreakdown?.strengths ?? []
  const improvements = aiFeedback.improvements ?? nested.improvements ?? aiFeedback.gradeBreakdown?.improvements ?? []
  const partNotes = aiFeedback.partNotes ?? nested.partNotes ?? []
  const mcqSummary = isMultiPart ? parseMultiPartMcqSummary(aiFeedback.feedback) : null
  const isCircuitProvisional =
    isCircuitSubmission && isCircuitEvalProvisionalFeedback(aiFeedback)
  const circuitPreviewPts = isCircuitProvisional
    ? resolveCircuitEvalDisplayPoints(
        aiFeedback as Record<string, unknown>,
        Number(aiFeedback.maxPoints) || undefined,
      )
    : null
  const circuitMaxPts = Number(aiFeedback.maxPoints) || 10

  const pct = remainingMs !== null ? Math.max(0, Math.min(100, 100 - (remainingMs / 15000) * 100)) : 0

  const displayScorePct = isCircuitProvisional
    ? circuitPreviewPts != null && circuitMaxPts > 0
      ? Math.round((circuitPreviewPts / circuitMaxPts) * 100)
      : null
    : aiFeedback.score

  const scoreColor =
    isCircuitProvisional
      ? "text-amber-700 dark:text-amber-300"
      : (displayScorePct || 0) >= 90 ? "text-green-600 dark:text-green-400" :
    (displayScorePct || 0) >= 70 ? "text-blue-600 dark:text-blue-400" :
    (displayScorePct || 0) >= 50 ? "text-yellow-600 dark:text-yellow-400" :
    "text-red-600 dark:text-red-400"

  const bgColor =
    isCircuitProvisional
      ? "bg-amber-50/90 dark:bg-amber-950/30 border-amber-300/70 dark:border-amber-700/70"
      : (displayScorePct || 0) >= 90 ? "bg-green-50/80 dark:bg-green-900/30 border-green-200/60 dark:border-green-700/60" :
    (displayScorePct || 0) >= 70 ? "bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/60" :
    (displayScorePct || 0) >= 50 ? "bg-yellow-50/80 dark:bg-yellow-900/30 border-yellow-200/60 dark:border-yellow-700/60" :
    "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl border ${bgColor}`}
    >
      <div className="flex items-center justify-between mb-3">
        {!isPersistentFeedback && (
          <div className="h-1.5 w-2/3 bg-slate-200/70 dark:bg-slate-600 rounded-full overflow-hidden">
            <div className="h-full bg-slate-600/70 dark:bg-slate-500" style={{ width: `${pct}%` }} />
          </div>
        )}
        {isPersistentFeedback && <div className="flex-1" />}
        <button
          type="button"
          onClick={() => { try { window.dispatchEvent(new CustomEvent('cc-feedback-close')) } catch {} }}
          className="text-xs px-2 py-1 rounded-md border bg-white/70 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 dark:border-slate-600 dark:text-slate-200"
        >
          {isPersistentFeedback ? "Dismiss" : "Got it"}
        </button>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {aiFeedback.aiGraded || isCircuitSubmission ? (
            <div className="p-2 bg-purple-100/80 dark:bg-purple-800/80 rounded-xl">
              <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          ) : (
            <div className="p-2 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100">
              {isCircuitProvisional
                ? "Provisional AI preview"
                : aiFeedback.aiGraded || isCircuitSubmission
                ? "Quiz Master Evaluation"
                : isMultiPart && (aiFeedback as { multiPartMcqGraded?: boolean }).multiPartMcqGraded
                  ? "Auto-graded (Multiple Choice)"
                  : "Manual Review Required"}
            </h4>
            {(isCircuitProvisional || aiFeedback.requiresManualReview) && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isCircuitProvisional
                  ? "Your instructor will confirm the final grade — this preview may change."
                  : isMultiPart && uploadPending
                  ? "Your uploaded solution will be reviewed by your instructor"
                  : "Your instructor will review this answer"}
              </p>
            )}
          </div>
        </div>
        {(displayScorePct !== undefined && displayScorePct !== null) || isCircuitProvisional ? (
          <div className="text-right">
            {isCircuitProvisional ? (
              <>
                <ClassroomProvisionalScoreBadge compact className="mb-1" />
                {circuitPreviewPts != null ? (
                  <div className={`text-2xl font-bold ${scoreColor}`}>
                    {circuitPreviewPts.toFixed(1)}
                    <span className="text-base font-semibold opacity-80">/{circuitMaxPts}</span>
                  </div>
                ) : null}
                <div className="text-xs text-amber-800 dark:text-amber-200">Preview only</div>
              </>
            ) : (
              <>
                <div className={`text-3xl font-bold ${scoreColor}`}>{displayScorePct}%</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Score</div>
                {aiFeedback.pointsEarned !== undefined && aiFeedback.maxPoints !== undefined && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {aiFeedback.pointsEarned.toFixed(1)}/{aiFeedback.maxPoints} pts
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
      {isCircuitProvisional ? (
        <CircuitProvisionalStudentNotice
          previewScore={circuitPreviewPts}
          maxPoints={circuitMaxPts}
          compact
          className="mb-4"
        />
      ) : null}
      {isMultiPart && (
        <div className="space-y-3">
          {mcqSummary && (
            <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
              <h5 className={FEEDBACK_SECTION_TITLE}>Multiple Choice</h5>
              <FeedbackMarkdown text={mcqSummary} />
            </div>
          )}
          {uploadPending && (
            <div className="p-3 rounded-xl border border-amber-200/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200">
              Uploaded solution points are pending instructor review.
            </div>
          )}
          {solutionFeedback && (
            <div className="p-4 rounded-xl border border-purple-200/60 dark:border-purple-700/50 bg-purple-50/50 dark:bg-purple-900/20">
              <h5 className={FEEDBACK_SECTION_TITLE}>
                {uploadPending ? "Solution Feedback (preview)" : "Worked Solution Feedback"}
              </h5>
              <FeedbackMarkdown text={solutionFeedback} className="text-sm leading-relaxed" />
            </div>
          )}
          {partNotes.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
              <h5 className={FEEDBACK_SECTION_TITLE}>Part-by-Part Notes</h5>
              <div className="space-y-2">
                {partNotes.map((part) => (
                  <div
                    key={part.partId}
                    className="p-3 rounded-lg border border-slate-200/50 dark:border-slate-600 bg-white/60 dark:bg-slate-900/40"
                  >
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                      Part {part.partId}
                    </p>
                    <FeedbackMarkdown text={part.notes} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {strengths.length > 0 && (
            <div className="p-4 rounded-xl border border-green-200/50 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/20">
              <h5 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">Strengths</h5>
              <FeedbackMarkdown
                text={strengths.map((s) => `- ${s}`).join("\n")}
                className="text-sm text-green-700 dark:text-green-300"
              />
            </div>
          )}
          {improvements.length > 0 && (
            <div className="p-4 rounded-xl border border-blue-200/50 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20">
              <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">How to Improve</h5>
              <FeedbackMarkdown
                text={improvements.map((s) => `- ${s}`).join("\n")}
                className="text-sm text-blue-700 dark:text-blue-300"
              />
            </div>
          )}
        </div>
      )}
      {aiFeedback.detailedExplanation && (
        <div className="mb-4 p-4 rounded-xl border border-blue-200/60 dark:border-blue-700/50 bg-white/50 dark:bg-slate-800">
          <h5 className={FEEDBACK_SECTION_TITLE}>Grade Explanation</h5>
          <FeedbackMarkdown text={aiFeedback.detailedExplanation} className="text-sm leading-relaxed" />
        </div>
      )}
      {aiFeedback.scoreBreakdown && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200/50 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
          <h5 className={FEEDBACK_SECTION_TITLE}>Score Breakdown</h5>
          <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {aiFeedback.scoreBreakdown.criteriaScores && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(aiFeedback.scoreBreakdown.criteriaScores).map(([k, v]) => {
                  const display =
                    typeof v === "number" || typeof v === "string"
                      ? v
                      : v != null && typeof v === "object" && "score" in (v as object)
                        ? String((v as { score?: unknown }).score)
                        : JSON.stringify(v)
                  return (
                    <span key={k}>
                      {k}: {display}
                    </span>
                  )
                })}
              </div>
            )}
            {aiFeedback.scoreBreakdown.rawScore != null && (
              <p>Raw score: {aiFeedback.scoreBreakdown.rawScore}%</p>
            )}
            {aiFeedback.scoreBreakdown.suspiciousTypingPenalty != null && aiFeedback.scoreBreakdown.suspiciousTypingPenalty > 0 && (
              <p className="text-amber-700 dark:text-amber-300">
                Typing penalty: −{aiFeedback.scoreBreakdown.suspiciousTypingPenalty}%
                {aiFeedback.scoreBreakdown.penaltyReason && (
                  <span className="block text-xs mt-0.5">{aiFeedback.scoreBreakdown.penaltyReason}</span>
                )}
              </p>
            )}
            {aiFeedback.scoreBreakdown.finalScore != null && (
              <p className="font-semibold">Final score: {aiFeedback.scoreBreakdown.finalScore}%</p>
            )}
          </div>
        </div>
      )}
      {aiFeedback.gradeBreakdown && (
        <div className="mb-4 space-y-4">
          {aiFeedback.gradeBreakdown.reasoning && (
            <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
              <h5 className={FEEDBACK_SECTION_TITLE}>Reasoning</h5>
              <FeedbackMarkdown text={aiFeedback.gradeBreakdown.reasoning} />
            </div>
          )}
          {!isMultiPart && aiFeedback.gradeBreakdown.strengths && aiFeedback.gradeBreakdown.strengths.length > 0 && (
            <div className="p-4 rounded-xl border border-green-200/50 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/20">
              <h5 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">Strengths</h5>
              <ul className="space-y-2">
                {aiFeedback.gradeBreakdown.strengths.map((strength, index) => (
                  <li key={index} className="text-sm text-green-700 dark:text-green-300">
                    <FeedbackMarkdown text={`- ${strength}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isMultiPart && aiFeedback.gradeBreakdown.weaknesses && aiFeedback.gradeBreakdown.weaknesses.length > 0 && (
            <div className="p-4 rounded-xl border border-yellow-200/50 dark:border-yellow-700/50 bg-yellow-50/50 dark:bg-yellow-900/20">
              <h5 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Areas for Improvement</h5>
              <ul className="space-y-2">
                {aiFeedback.gradeBreakdown.weaknesses.map((weakness, index) => (
                  <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                    <FeedbackMarkdown text={`- ${weakness}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isMultiPart && aiFeedback.gradeBreakdown.improvements && aiFeedback.gradeBreakdown.improvements.length > 0 && (
            <div className="p-4 rounded-xl border border-blue-200/50 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-900/20">
              <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">How to Improve</h5>
              <ul className="space-y-2">
                {aiFeedback.gradeBreakdown.improvements.map((improvement, index) => (
                  <li key={index} className="text-sm text-blue-700 dark:text-blue-300">
                    <FeedbackMarkdown text={`- ${improvement}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {sampleAnswers && sampleAnswers.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
          <h5 className={FEEDBACK_SECTION_TITLE}>Sample Correct Answers</h5>
          <div className="space-y-4">
            {sampleAnswers.map((sample, index) => (
              <div key={index} className="border border-slate-200/50 dark:border-slate-700/50 rounded-lg overflow-hidden">
                <div className="bg-slate-100/50 dark:bg-slate-800/50 px-3 py-2 border-b border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{sample.approach}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-300">{sample.description}</span>
                  </div>
                </div>
                <div className="p-3">
                  <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{sample.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {aiFeedback.itemizedIssues && aiFeedback.itemizedIssues.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-amber-200/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-900/20">
          <h5 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3">Itemized Feedback</h5>
          <div className="space-y-2">
            {aiFeedback.itemizedIssues.map((item, index) => (
              <div key={index} className="p-3 rounded-lg border border-amber-200/40 dark:border-amber-700/40 bg-white/60 dark:bg-slate-800/60">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  <FeedbackMarkdown text={`${index + 1}. ${item.issue}`} />
                </div>
                {item.location && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-medium">Location:</span> {item.location}
                  </p>
                )}
                {item.fix && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Fix:</span> <FeedbackMarkdown text={item.fix} className="text-xs inline" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {aiFeedback.feedback && !isMultiPart && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
          <h5 className={FEEDBACK_SECTION_TITLE}>General Feedback</h5>
          <FeedbackMarkdown text={aiFeedback.feedback} className="text-sm leading-relaxed" />
        </div>
      )}
      {aiFeedback.criteria && (
        <div className="mb-4 space-y-2">
          <h5 className={FEEDBACK_SECTION_TITLE}>Detailed Scoring</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Correctness</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{aiFeedback.criteria.correctness}/40</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (aiFeedback.criteria.correctness / 40) * 100)}%` }}></div>
              </div>
            </div>
            <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Code Quality</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{aiFeedback.criteria.codeQuality}/25</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (aiFeedback.criteria.codeQuality / 25) * 100)}%` }}></div>
              </div>
            </div>
            <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Efficiency</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{aiFeedback.criteria.efficiency}/20</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (aiFeedback.criteria.efficiency / 20) * 100)}%` }}></div>
              </div>
            </div>
            <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Completeness</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{aiFeedback.criteria.completeness}/15</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-orange-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (aiFeedback.criteria.completeness / 15) * 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {aiFeedback.suggestions && aiFeedback.suggestions.length > 0 && (
        <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-white/50 dark:bg-slate-800">
          <h5 className={FEEDBACK_SECTION_TITLE}>Quick Tips</h5>
          <ul className="space-y-2">
            {aiFeedback.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-slate-700 dark:text-slate-300">
                <FeedbackMarkdown text={`- ${suggestion}`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
})

interface Question {
  id: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string
  correct_answer: string
  question_type: string
  requires_code?: boolean
  hint?: string
  hint_penalty?: number
  circuit_spec?: unknown
  subquestions?: unknown
  solution_upload_config?: unknown
}

interface QuestionRendererProps {
  question: Question
  selectedAnswer: string
  selectedMultiAnswers: string[]
  code: string
  showFeedback: boolean
  isSubmittingAnswer: boolean
  isCorrect: boolean
  partialCreditPoints: number | null
  onAnswerChange: (answer: string) => void
  onMultiAnswerToggle: (option: string) => void
  onCodeChange: (code: string) => void
  isPreviewMode?: boolean
  onExplainClick?: () => void
  isExplaining?: boolean
  explanation?: string
  isLocked?: boolean
  aiFeedback?: {
    score?: number
    feedback?: string
    criteria?: {
      correctness: number
      codeQuality: number
      efficiency: number
      completeness: number
    }
    suggestions?: string[]
    detailedExplanation?: string
    gradeBreakdown?: {
      reasoning: string
      strengths: string[]
      weaknesses: string[]
      improvements: string[]
    }
    aiGraded?: boolean
    requiresManualReview?: boolean
  }
  sampleAnswers?: Array<{
    approach: string
    description: string
    code: string
  }>
  // New props for code_write_plot
  uploadedPlot?: string | null
  onPlotUpload?: (file: File, base64: string) => void
  onPlotRemove?: () => void
  /** Callback to record typing replay for anti-cheat (code questions only) */
  onTypingReplay?: (replay: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }>; initialDocument?: string }) => void
  attemptId?: number | null
  studentDatabaseId?: number | null
  /** Pause strict anti-cheat while solution file picker is open. */
  onAntiCheatSuspendChange?: (suspended: boolean) => void
  antiCheatSuspendedForSolutionUpload?: boolean
  isAntiCheatSuspended?: () => boolean
  circuitAnswerSnapshotRef?: React.MutableRefObject<(() => string) | null>
  circuitPrepareSubmitRef?: React.MutableRefObject<(() => void) | null>
  /** Practice Hub: full option review after submit (wrong-answer feedback). */
  answerReview?: PracticeAnswerReview | null
  /** Locked MCQ/T/F/select_all grade from server (for correct/incorrect banner). */
  lockedObjectiveGrade?: {
    isCorrect: boolean
    pointsEarned: number
    score?: number
    feedback?: string
    maxPoints?: number
    correctLetters?: string[]
  } | null
}

// Memoized to prevent unnecessary re-renders during quiz taking
export const QuestionRenderer = memo(function QuestionRenderer({
  question,
  selectedAnswer,
  selectedMultiAnswers,
  code,
  showFeedback,
  isSubmittingAnswer,
  isCorrect,
  partialCreditPoints,
  onAnswerChange,
  onMultiAnswerToggle,
  onCodeChange,
  isPreviewMode = false,
  onExplainClick,
  isExplaining = false,
  explanation,
  isLocked = false,
  aiFeedback,
  sampleAnswers,
  uploadedPlot,
  onPlotUpload,
  onPlotRemove,
  onTypingReplay,
  attemptId,
  studentDatabaseId,
  onAntiCheatSuspendChange,
  antiCheatSuspendedForSolutionUpload = false,
  isAntiCheatSuspended,
  circuitAnswerSnapshotRef,
  circuitPrepareSubmitRef,
  answerReview,
  lockedObjectiveGrade,
}: QuestionRendererProps) {
  const questionType = question.question_type?.toLowerCase() || "mcq"
  const solutionUploadOn = questionSolutionUploadEnabled(question)
  const solutionCfg = parseQuestionSolutionUploadConfig(question.solution_upload_config)
  const { gradable: gradableAnswerRaw, solutionUploads: parsedUploads } = unwrapStudentAnswerForGrading(
    selectedAnswer,
    questionType,
  )
  const gradableDisplay =
    typeof gradableAnswerRaw === "string"
      ? gradableAnswerRaw
      : Array.isArray(gradableAnswerRaw)
        ? gradableAnswerRaw.join(",")
        : ""

  const emitWrappedAnswer = (answer: string, uploads: SolutionUploadsMap) => {
    if (!solutionUploadOn) {
      onAnswerChange(answer)
      return
    }
    onAnswerChange(
      JSON.stringify({
        answer,
        solution_uploads: Object.keys(uploads).length > 0 ? uploads : undefined,
      }),
    )
  }

  const setRootUpload = (att: SolutionUploadAttachment | null) => {
    const uploads = { ...parsedUploads }
    if (att) uploads[ROOT_SOLUTION_PART_KEY] = att
    else delete uploads[ROOT_SOLUTION_PART_KEY]
    emitWrappedAnswer(gradableDisplay, uploads)
  }

  const singleSolutionUploadBlock =
    solutionUploadOn && ["mcq", "true_false", "select_all"].includes(questionType) ? (
      <StudentSolutionUpload
        partId={ROOT_SOLUTION_PART_KEY}
        label={solutionCfg.label ?? "Upload worked solution"}
        bonusPercent={solutionCfg.bonus_percent ?? 10}
        attachment={parsedUploads[ROOT_SOLUTION_PART_KEY] ?? null}
        onChange={setRootUpload}
        disabled={isSubmittingAnswer}
        locked={isLocked}
        attemptId={attemptId}
        questionId={question.id}
        studentDatabaseId={studentDatabaseId}
        onAntiCheatSuspendChange={onAntiCheatSuspendChange}
      />
    ) : null
  const [reorderedLines, setReorderedLines] = useState<string[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const editorRef = useRef<any>(null)
  const debounceRef = useRef<any>(null)
  const lastEventDispatchRef = useRef<number>(0)
  const eventDebounceDelay = 5000 // Only dispatch event once every 5 seconds
  const replayRef = useRef<{ startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }>; initialDocument?: string }>({ startTime: 0, events: [] })
  useEffect(() => {
    replayRef.current = { startTime: 0, events: [] }
  }, [question.id])

  // Responsive Monaco Editor height
  const [monacoHeight, setMonacoHeight] = useState("400px")
  useEffect(() => {
    const updateHeight = () => {
      if (typeof window !== "undefined") {
        setMonacoHeight(window.innerWidth < 640 ? "300px" : "400px")
      }
    }
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  // Stable callback to prevent infinite loops
  const handleGeminiDetected = useCallback((reason: string) => {
    if (isAntiCheatSuspended?.()) return
    if (!isBrowserAiEnforcementPlatform()) return
    // Debounce event dispatching to prevent rapid-fire events
    const now = Date.now()
    if (now - lastEventDispatchRef.current < eventDebounceDelay) {
      return
    }
    lastEventDispatchRef.current = now

    // Dispatch custom event that parent quiz-taker can listen to
    // This allows detection at the question level without tight coupling
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gemini-detected", {
          detail: {
            questionId: question.id,
            reason,
            timestamp: new Date().toISOString(),
          },
        })
      )
    }
    
    // Also log to observability
    queueEvent("quiz", "antiCheat", "GEMINI_DETECTED_QUESTION_LEVEL", {
      questionId: question.id,
      reason,
    }, "warning")
  }, [question.id, isAntiCheatSuspended])

  // Practice Hub passes `answerReview` (even when null) — no anti-cheat / fullscreen there.
  const isPracticeHub = answerReview !== undefined

  // Gemini detection during quiz (desktop Windows/macOS only; not phones/tablets)
  useGeminiDetector({
    enabled:
      !isPracticeHub &&
      isBrowserAiEnforcementPlatform() &&
      !isPreviewMode &&
      !isLocked &&
      !antiCheatSuspendedForSolutionUpload &&
      !isAntiCheatSuspended?.(),
    onDetected: handleGeminiDetected,
    isDetectionPaused: isAntiCheatSuspended,
    requireFullscreen: !isPracticeHub,
  })


  // Initialize reordered lines for code_reorder type
  useState(() => {
    if (questionType === "code_reorder" && question.option_a) {
      try {
        const lines = JSON.parse(question.option_a)
        setReorderedLines(lines)
      } catch (e) {
        // Failed to parse code_reorder lines
      }
    }
  })

  const handleDragStart = (index: number) => {
    if (isLocked) return
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (isLocked || draggedIndex === null || draggedIndex === index) return

    const newLines = [...reorderedLines]
    const draggedLine = newLines[draggedIndex]
    newLines.splice(draggedIndex, 1)
    newLines.splice(index, 0, draggedLine)
    setReorderedLines(newLines)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    if (isLocked) return
    setDraggedIndex(null)
    onAnswerChange(JSON.stringify(reorderedLines))
  }

  const ExplainSection = () => {
    if (!onExplainClick) return null

    return (
      <div className="mt-4 space-y-3">
        <button
          onClick={onExplainClick}
          disabled={isExplaining}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExplaining ? "Generating explanation..." : "Explain this question"}
        </button>

        {explanation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600 rounded-lg border"
          >
            <h4 className="font-semibold mb-2 text-foreground">AI Explanation:</h4>
            <div className="text-sm text-foreground whitespace-pre-wrap">{explanation}</div>
          </motion.div>
        )}
      </div>
    )
  }

      const LockedBanner = () => {
        if (!isLocked) return null

        const isCircuitProvisionalLocked = questionType === "circuit_submission"
        const isObjectiveLocked = ["mcq", "true_false", "select_all", "multi_output"].includes(questionType)

        if (isCircuitProvisionalLocked) {
          return (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 flex items-start gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-100/80 dark:bg-amber-800/80 rounded-lg sm:rounded-xl flex-shrink-0">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs sm:text-sm text-amber-900 dark:text-amber-200 mb-1">
                  Circuit submission recorded — awaiting instructor review
                </p>
                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 break-words">
                  Your solution was submitted. Any AI score shown below is a provisional preview, not your final
                  grade. Your instructor will review your work and may adjust the score. You cannot revise or
                  resubmit.
                </p>
              </div>
            </div>
          )
        }

        if (isObjectiveLocked && lockedObjectiveGrade) {
          const partial =
            !lockedObjectiveGrade.isCorrect && (lockedObjectiveGrade.pointsEarned ?? 0) > 0
          const tone = lockedObjectiveGrade.isCorrect
            ? "emerald"
            : partial
              ? "amber"
              : "red"
          const maxPts = lockedObjectiveGrade.maxPoints ?? question.points ?? 1
          const earnedPts = lockedObjectiveGrade.pointsEarned ?? 0
          const isSelectAllType = questionType === "select_all" || questionType === "multi_output"

          if (isSelectAllType) {
            const statusLabel = lockedObjectiveGrade.isCorrect
              ? "Correct"
              : partial
                ? "Partial credit"
                : "Incorrect"
            const ptsLabel = `${earnedPts}/${maxPts} pt${maxPts === 1 ? "" : "s"}`

            return (
              <div
                className={`mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  tone === "emerald"
                    ? "bg-emerald-50/90 dark:bg-emerald-900/25 border-emerald-200/70 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-100"
                    : tone === "amber"
                      ? "bg-amber-50/90 dark:bg-amber-900/25 border-amber-200/70 dark:border-amber-700/50 text-amber-900 dark:text-amber-100"
                      : "bg-red-50/90 dark:bg-red-900/25 border-red-200/70 dark:border-red-700/50 text-red-900 dark:text-red-100"
                }`}
              >
                {lockedObjectiveGrade.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : partial ? (
                  <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <span className="font-medium">{statusLabel}</span>
                <span className="opacity-60">·</span>
                <span>{ptsLabel}</span>
                <span className="opacity-60">·</span>
                <span className="text-xs opacity-75">Locked</span>
              </div>
            )
          }

          const title = lockedObjectiveGrade.isCorrect
            ? "✓ Correct — answer locked"
            : partial
              ? "Partial credit — answer locked"
              : "✗ Incorrect — answer locked"
          const detail = lockedObjectiveGrade.isCorrect
            ? `You earned ${lockedObjectiveGrade.pointsEarned} point${lockedObjectiveGrade.pointsEarned === 1 ? "" : "s"}. Correct options are highlighted below.`
            : partial
              ? `You earned ${lockedObjectiveGrade.pointsEarned} of ${maxPts} point${maxPts === 1 ? "" : "s"}. Review the highlighted options below.`
              : "That answer is incorrect. Correct options are highlighted below. You cannot change your answer."

          return (
            <div
              className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-3 border ${
                tone === "emerald"
                  ? "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60"
                  : tone === "amber"
                    ? "bg-amber-50/80 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-700/60"
                    : "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"
              }`}
            >
              <div
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex-shrink-0 ${
                  tone === "emerald"
                    ? "bg-emerald-100/80 dark:bg-emerald-800/80"
                    : tone === "amber"
                      ? "bg-amber-100/80 dark:bg-amber-800/80"
                      : "bg-red-100/80 dark:bg-red-800/80"
                }`}
              >
                {lockedObjectiveGrade.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700 dark:text-emerald-400" />
                ) : partial ? (
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
                ) : (
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-700 dark:text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-semibold text-xs sm:text-sm mb-1 ${
                    tone === "emerald"
                      ? "text-emerald-900 dark:text-emerald-200"
                      : tone === "amber"
                        ? "text-amber-900 dark:text-amber-200"
                        : "text-red-900 dark:text-red-200"
                  }`}
                >
                  {title}
                </p>
                <p
                  className={`text-xs sm:text-sm break-words ${
                    tone === "emerald"
                      ? "text-emerald-800 dark:text-emerald-300"
                      : tone === "amber"
                        ? "text-amber-800 dark:text-amber-300"
                        : "text-red-800 dark:text-red-300"
                  }`}
                >
                  {detail}
                </p>
              </div>
            </div>
          )
        }

        return (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-green-50/80 dark:bg-green-900/30 border border-green-200/60 dark:border-green-700/60 flex items-start gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100/80 dark:bg-green-800/80 rounded-lg sm:rounded-xl flex-shrink-0">
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs sm:text-sm text-green-900 dark:text-green-200 mb-1">Question Locked - Answer Recorded</p>
              <p className="text-xs sm:text-sm text-green-800 dark:text-green-300 break-words">Your answer has been submitted and points awarded. You cannot make changes to this question.</p>
            </div>
          </div>
        )
      }

  const PracticeAnswerReviewBlock = () => {
    if ((!showFeedback && !isLocked) || !answerReview) return null
    return <PracticeAnswerReviewBanner review={answerReview} />
  }

  // Render based on question type
  switch (questionType) {
    case "true_false":
      let correctTrueFalseAnswer = question.correct_answer
      
      // Handle malformed JSON like {"True"} or {"False"}
      try {
        if (typeof correctTrueFalseAnswer === 'string' && correctTrueFalseAnswer.includes('{')) {
          const parsed = JSON.parse(correctTrueFalseAnswer)
          if (typeof parsed === 'string') {
            correctTrueFalseAnswer = parsed
          }
        }
      } catch (e) {
        // Keep original value if JSON parsing fails
      }
      
      if (correctTrueFalseAnswer && typeof correctTrueFalseAnswer === 'string' && correctTrueFalseAnswer.length === 1 && /[AB]/i.test(correctTrueFalseAnswer)) {
        // It's an option letter (A or B), convert to text
        const optionKey = `option_${correctTrueFalseAnswer.toLowerCase()}` as keyof Question
        const optionValue = question[optionKey] as string
        if (optionValue && optionValue !== "null") {
          correctTrueFalseAnswer = optionValue
        }
      }

      return (
        <div className={isPreviewMode ? "space-y-3" : QUIZ_OBJECTIVE_SHELL}>
          <LockedBanner />
          <div className="space-y-2.5">
          {[
            { text: "True", letter: "A" },
            { text: "False", letter: "B" },
          ].map((option, index) => {
            const isSelected = (solutionUploadOn ? gradableDisplay : selectedAnswer) === option.letter
            let isCorrectOption = false
            let isWrongSelection = false

            if ((showFeedback || isLocked) && answerReview) {
              const row = answerReview.options.find((o) => o.letter === option.letter)
              isCorrectOption = row?.isCorrect === true
              isWrongSelection = row?.isSelected === true && !row?.isCorrect
            } else if ((showFeedback || isLocked) && lockedObjectiveGrade) {
              if (lockedObjectiveGrade.isCorrect) {
                isCorrectOption = isSelected
                isWrongSelection = false
              } else {
                isWrongSelection = isSelected
                isCorrectOption = !isSelected
              }
            } else if (showFeedback || isLocked) {
              isCorrectOption = isQuizMcqOptionCorrect(option.letter, option.text, question.correct_answer)
              isWrongSelection = isSelected && !isCorrectOption
            }

            return (
              <motion.button
                key={option.text}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={!showFeedback && !isLocked ? { scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" } : {}}
                whileTap={!showFeedback && !isLocked ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (showFeedback || isSubmittingAnswer || isLocked) return
                  // Log answer selection
                  queueEvent("quiz", "question", "ANSWER_SELECT", {
                    questionId: question.id,
                    questionType: "true_false",
                    selectedOption: option.letter,
                    previousAnswer: selectedAnswer,
                    optionText: option.text
                  }, "info")
                  onAnswerChange(option.letter)
                }}
                disabled={showFeedback || isSubmittingAnswer || isLocked}
                className={cn(
                  "w-full rounded-xl border-2 p-3.5 text-left transition-all sm:p-4",
                  isCorrectOption
                    ? "border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950/50"
                    : isWrongSelection
                      ? "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950/50"
                      : isSelected
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent)]/10 shadow-sm shadow-[var(--cc-accent)]/10 dark:bg-[var(--cc-accent)]/15"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent)]/45 hover:shadow-sm",
                  (showFeedback || isSubmittingAnswer || isLocked) && "cursor-not-allowed opacity-60",
                )}
                data-nosnippet
              >
                <div className="flex items-center gap-3" data-nosnippet>
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${
                      isCorrectOption
                        ? "border-green-500 bg-green-500 text-white"
                        : isWrongSelection
                          ? "border-red-500 bg-red-500 text-white"
                          : isSelected
                            ? "border-[var(--cc-accent)] bg-[var(--cc-accent)] text-white"
                            : "border-[var(--border)] text-[var(--cc-text)] bg-[var(--muted)]/40"
                    }`}
                  >
                    {isCorrectOption ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isWrongSelection ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      option.text[0]
                    )}
                  </div>
                  <div className="text-[var(--cc-text)]">
                    <QuestionTextRenderer text={option.text} />
                  </div>
                </div>
              </motion.button>
            )
          })}
          </div>
          <PracticeAnswerReviewBlock />
          <ExplainSection />
        </div>
      )

    case "mcq":
    case "multiple_choice":
      const mcqOptions = ["A", "B", "C", "D", "E"].filter((option) => {
        const optionKey = `option_${option.toLowerCase()}` as keyof Question
        const optionValue = question[optionKey]
        // Filter out null, "null", empty strings, and undefined
        return optionValue && optionValue !== "null" && String(optionValue).trim() !== ""
      })

      return (
        <div className={isPreviewMode ? "space-y-3" : QUIZ_OBJECTIVE_SHELL}>
          <LockedBanner />
          <div className="space-y-2.5">
          {mcqOptions.map((option, index) => {
            const optionKey = `option_${option.toLowerCase()}` as keyof Question
            const optionText = question[optionKey] as string

            const isSelected = (solutionUploadOn ? gradableDisplay : selectedAnswer) === option
            let isCorrectOption = false
            let isWrongSelection = false

            if ((showFeedback || isLocked) && answerReview) {
              const row = answerReview.options.find((o) => o.letter === option)
              isCorrectOption = row?.isCorrect === true
              isWrongSelection = row?.isSelected === true && !row?.isCorrect
            } else if ((showFeedback || isLocked) && lockedObjectiveGrade) {
              const correctLetters = lockedObjectiveGrade.correctLetters ?? []
              if (correctLetters.length > 0) {
                isCorrectOption = correctLetters.includes(option)
                isWrongSelection = isSelected && !correctLetters.includes(option)
              } else if (lockedObjectiveGrade.isCorrect) {
                isCorrectOption = isSelected
                isWrongSelection = false
              } else {
                isWrongSelection = isSelected
                isCorrectOption = false
              }
            } else if (showFeedback || isLocked) {
              isCorrectOption = isQuizMcqOptionCorrect(option, optionText, question.correct_answer)
              isWrongSelection = isSelected && !isCorrectOption
            }

            return (
              <motion.button
                key={option}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={!showFeedback && !isLocked ? { scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" } : {}}
                whileTap={!showFeedback && !isLocked ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (showFeedback || isSubmittingAnswer || isLocked) return
                  // Log answer selection
                  queueEvent("quiz", "question", "ANSWER_SELECT", {
                    questionId: question.id,
                    questionType: "mcq",
                    selectedOption: option,
                    previousAnswer: selectedAnswer,
                    optionText: optionText
                  }, "info")
                  emitWrappedAnswer(option, parsedUploads)
                }}
                disabled={showFeedback || isSubmittingAnswer || isLocked}
                className={cn(
                  "w-full rounded-xl border-2 p-3.5 text-left transition-all sm:p-4",
                  isCorrectOption
                    ? "border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950/50"
                    : isWrongSelection
                      ? "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950/50"
                      : isSelected
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent)]/10 shadow-sm shadow-[var(--cc-accent)]/10 dark:bg-[var(--cc-accent)]/15"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--cc-accent)]/45 hover:shadow-sm",
                  (showFeedback || isSubmittingAnswer || isLocked) && "cursor-not-allowed opacity-60",
                )}
                data-nosnippet
              >
                <div className="flex items-center gap-3" data-nosnippet>
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm ${
                      isCorrectOption
                        ? "border-green-500 bg-green-500 text-white"
                        : isWrongSelection
                          ? "border-red-500 bg-red-500 text-white"
                          : isSelected
                            ? "border-[var(--cc-accent)] bg-[var(--cc-accent)] text-white"
                            : "border-[var(--border)] text-[var(--cc-text)] bg-[var(--muted)]/40"
                    }`}
                  >
                    {isCorrectOption ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isWrongSelection ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      option
                    )}
                  </div>
                  <div className="text-slate-900 dark:text-slate-100 flex-1 min-w-0">
                    <QuestionTextRenderer text={optionText} />
                  </div>
                </div>
              </motion.button>
            )
          })}
          </div>
          {singleSolutionUploadBlock}
          <PracticeAnswerReviewBlock />
          <ExplainSection />
        </div>
      )

    case "select_all":
    case "multi_output":
      const selectAllOptions = ["A", "B", "C", "D", "E"].filter((option) => {
        const optionKey = `option_${option.toLowerCase()}` as keyof Question
        const optionValue = question[optionKey]
        // Filter out null, "null", empty strings, and undefined
        return optionValue && optionValue !== "null" && String(optionValue).trim() !== ""
      })

      const selectAllCorrectLetters = new Set(
        lockedObjectiveGrade?.correctLetters?.length
          ? lockedObjectiveGrade.correctLetters
          : showFeedback || isLocked
            ? resolveSelectAllCorrectLetters(question)
            : [],
      )
      const selectAllPartialCredit =
        Boolean(lockedObjectiveGrade) &&
        !lockedObjectiveGrade!.isCorrect &&
        (lockedObjectiveGrade!.pointsEarned ?? 0) > 0

      return (
        <div className={isPreviewMode ? "space-y-3" : QUIZ_OBJECTIVE_SHELL}>
          <LockedBanner />
          {!isLocked ? (
            <p className="text-sm italic text-muted-foreground dark:text-slate-200">Select all that apply:</p>
          ) : null}
          <div className="space-y-2.5">
          {selectAllOptions.map((option, index) => {
            const optionKey = `option_${option.toLowerCase()}` as keyof Question
            const optionText = question[optionKey] as string

            const isSelected = selectedMultiAnswers.includes(option)
            let isCorrectOption = false
            let isWrongSelection = false
            let isPartialCreditSelection = false

            if ((showFeedback || isLocked) && answerReview) {
              const row = answerReview.options.find((o) => o.letter === option)
              const partialCredit =
                !answerReview.isCorrect &&
                (answerReview.isPartialCredit === true ||
                  (typeof answerReview.score === "number" &&
                    answerReview.score > 0 &&
                    answerReview.score < 100))

              if (partialCredit && row) {
                isCorrectOption = row.isCorrect === true
                isWrongSelection = row.isSelected === true && !row.isCorrect
                isPartialCreditSelection = row.isSelected === true && row.isCorrect === true
              } else {
                isCorrectOption = row?.isCorrect === true
                isWrongSelection = row?.isSelected === true && !row?.isCorrect
              }
            } else if (showFeedback || isLocked) {
              isCorrectOption = selectAllCorrectLetters.has(option)
              isWrongSelection = isSelected && !isCorrectOption
              isPartialCreditSelection =
                selectAllPartialCredit && isCorrectOption && isSelected
              if (
                selectAllPartialCredit &&
                isSelected &&
                selectAllCorrectLetters.size === 0
              ) {
                isWrongSelection = false
                isPartialCreditSelection = true
              }
              if (
                lockedObjectiveGrade?.isCorrect &&
                selectAllCorrectLetters.size === 0 &&
                isSelected
              ) {
                isCorrectOption = true
                isWrongSelection = false
                isPartialCreditSelection = false
              }
            }

            const optionToneClass = isWrongSelection
              ? "border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-600"
              : isPartialCreditSelection
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-500"
                : isCorrectOption
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-600"
                  : isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10 dark:border-primary"
                    : "border-slate-200 dark:border-slate-500 hover:border-primary/50 bg-white dark:bg-slate-800"

            return (
              <motion.div
                key={option}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={!showFeedback && !isLocked ? { scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" } : {}}
                whileTap={!showFeedback && !isLocked ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (showFeedback || isSubmittingAnswer || isLocked) return
                  queueEvent("quiz", "question", "MULTI_ANSWER_TOGGLE", {
                    questionId: question.id,
                    questionType: questionType,
                    option: option,
                    action: selectedMultiAnswers.includes(option) ? "deselect" : "select",
                    currentSelections: selectedMultiAnswers,
                    optionText: optionText
                  }, "info")
                  onMultiAnswerToggle(option)
                }}
                className={`w-full text-left rounded-xl border-2 transition-all cursor-pointer p-3.5 sm:p-4 ${optionToneClass} ${showFeedback || isSubmittingAnswer || isLocked ? "cursor-not-allowed" : "hover:shadow-sm"}`}
                data-nosnippet
              >
                <div className="flex items-center gap-3" data-nosnippet>
                  <Checkbox 
                    checked={isSelected} 
                    disabled={showFeedback || isSubmittingAnswer || isLocked}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (showFeedback || isSubmittingAnswer || isLocked) return
                      onMultiAnswerToggle(option)
                    }}
                  />
                  <div className="text-slate-900 dark:text-slate-100 flex-1 min-w-0">
                    <QuestionTextRenderer text={optionText} />
                  </div>
                  {(showFeedback || isLocked) && isCorrectOption && !isPartialCreditSelection ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                  ) : null}
                  {(showFeedback || isLocked) && isPartialCreditSelection ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : null}
                  {(showFeedback || isLocked) && isWrongSelection ? (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                  ) : null}
                </div>
              </motion.div>
            )
          })}
          </div>
          <PracticeAnswerReviewBlock />
          {!lockedObjectiveGrade ? (
            <AIFeedbackDisplay
              showFeedback={showFeedback}
              aiFeedback={aiFeedback}
              sampleAnswers={sampleAnswers}
              questionType={questionType}
            />
          ) : null}
          <ExplainSection />
        </div>
      )

    case "fill_blank":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <Input
            type="text"
            value={selectedAnswer || ""}
            onChange={(e) => {
              // Log text input change
              queueEvent("quiz", "question", "TEXT_INPUT_CHANGE", {
                questionId: question.id,
                questionType: "fill_blank",
                inputLength: e.target.value.length,
                hasContent: e.target.value.length > 0
              }, "info")
              onAnswerChange(e.target.value)
            }}
            placeholder="Enter your answer..."
            disabled={isSubmittingAnswer || isLocked}
            className="w-full text-lg p-4 text-foreground dark:text-slate-100 placeholder:text-muted-foreground dark:placeholder:text-slate-400 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
          />
          <ExplainSection />
        </div>
      )

    case "code_output":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <Textarea
            value={selectedAnswer || ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Enter the predicted output..."
            rows={6}
            disabled={isSubmittingAnswer || isLocked}
            className="w-full font-mono text-foreground dark:text-slate-100 placeholder:text-muted-foreground dark:placeholder:text-slate-400 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
          />
          <ExplainSection />
        </div>
      )

    case "code_debug":
    case "code_problem":
    case "code_write":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <div
            className="border border-slate-200 dark:border-slate-500 rounded-lg overflow-hidden"
            onContextMenu={!isPreviewMode ? (e) => e.preventDefault() : undefined}
          >
            <QuizAssessmentMonacoEditor
              height={monacoHeight}
              language="cpp"
              value={code || ""}
              onMount={(editor) => {
                editorRef.current = editor
                // Restore cursor position if saved
                try {
                  const posKey = `qpos_${question.id}`
                  const saved = sessionStorage.getItem(posKey)
                  if (saved) {
                    const parsed = JSON.parse(saved)
                    editor.setPosition(parsed)
                  }
                } catch {}
                
                // Typing replay: record edits for anti-cheat (replay + paste detection)
                if (!isPreviewMode && onTypingReplay) {
                  const model = editor.getModel()
                  if (model) {
                    // Capture initial document (Trailblazer template or Scholar empty) - playback starts with this
                    replayRef.current.initialDocument = model.getValue()
                    const dispose = model.onDidChangeContent((e) => {
                      const now = Date.now()
                      if (replayRef.current.events.length === 0) {
                        replayRef.current.startTime = now
                      }
                      const startTime = replayRef.current.startTime
                      // Monaco changes are ordered end-to-beginning; reverse for chronological
                      const changes = [...(e.changes || [])].reverse()
                      for (const c of changes) {
                        const offset = (c as any).rangeOffset ?? 0
                        const rangeLength = (c as any).rangeLength ?? 0
                        const text = (c as any).text ?? ""
                        if (rangeLength > 0 && text.length === 0) {
                          replayRef.current.events.push({ t: now - startTime, op: "d", offset, text: "", len: rangeLength })
                        } else if (text.length > 0) {
                          if (rangeLength > 0) {
                            replayRef.current.events.push({ t: now - startTime, op: "d", offset, text: "", len: rangeLength })
                          }
                          replayRef.current.events.push({ t: now - startTime, op: "i", offset, text })
                        }
                      }
                      onTypingReplay({ ...replayRef.current })
                    })
                    // Store dispose for cleanup if needed (editor unmounts on question change)
                  }
                }

                // Anti-cheat: Disable copy/paste for code questions (keyboard + right-click)
                if (!isPreviewMode) {
                  editor.onKeyDown((e) => {
                    const ev = e.browserEvent
                    const ctrlOrCmd = ev.ctrlKey || ev.metaKey
                    const key = e.keyCode
                    // 67=C, 86=V, 88=X (copy, paste, cut)
                    if (ctrlOrCmd && (key === 67 || key === 86 || key === 88)) {
                      ev.preventDefault()
                      ev.stopPropagation()
                    }
                  })
                }
                
                // CRITICAL: Prevent accidental submission on mobile/iPad when keyboard opens
                try {
                  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent)
                  if (isMobile) {
                    editor.onKeyDown((e) => {
                      if (e.keyCode === 13 && e.browserEvent) {
                        e.browserEvent.stopPropagation()
                      }
                    })
                  }
                } catch (error) {
                  console.log("[QuestionRenderer] Could not set up keyboard blocking:", error)
                }
              }}
              onChange={(v) => {
                queueEvent("quiz", "codeWrite", "CODE_EDIT", {
                  questionId: question.id,
                  questionType: questionType,
                  codeLength: v.length,
                  lineCount: v.split("\n").length,
                }, "info")
                onCodeChange(v)
                if (debounceRef.current) clearTimeout(debounceRef.current)
                debounceRef.current = setTimeout(() => {
                  const pos = editorRef.current?.getPosition()
                  if (pos) {
                    editorRef.current?.setPosition(pos)
                    try {
                      sessionStorage.setItem(`qpos_${question.id}`, JSON.stringify(pos))
                    } catch {}
                  }
                }, 100)
              }}
              options={{
                fontSize: 14,
                automaticLayout: true,
                formatOnType: false,
                formatOnPaste: false,
                autoClosingBrackets: "never",
                autoClosingQuotes: "never",
                autoIndent: "none",
                tabSize: 4,
                insertSpaces: true,
                readOnly: isLocked || (showFeedback && !aiFeedback?.aiGraded),
                contextmenu: isPreviewMode,
                acceptSuggestionOnEnter: "off",
                acceptSuggestionOnCommitCharacter: false,
              }}
            />
          </div>
          {(() => {
            // Auto-save to localStorage every 30s using stable composite key
            const studentId = typeof window !== 'undefined' ? sessionStorage.getItem('studentId') || 'anon' : 'anon'
            const quizId = typeof window !== 'undefined' ? sessionStorage.getItem('currentQuizId') || 'unknown' : 'unknown'
            const key = `code_${studentId}_${quizId}_${question.id}`
            // Load once if present
            if (typeof window !== 'undefined') {
              try {
                const saved = localStorage.getItem(key)
                if (saved && !code) {
                  onCodeChange(saved)
                }
              } catch {}
            }
            return null
          })()}
          <AutoSaveCode code={code} questionId={question.id} />
          {questionType === "code_debug" && question.hint && (
            <p className="text-sm text-muted-foreground dark:text-slate-300 italic">Hint: {question.hint}</p>
          )}
          <AIFeedbackDisplay showFeedback={showFeedback} aiFeedback={aiFeedback} sampleAnswers={sampleAnswers} questionType={questionType} />
          <ExplainSection />
        </div>
      )

    case "code_write_plot":
      // Ensure MATLAB template for code_write_plot questions
      const matlabTemplate = `% MATLAB Script\n% Start your code here\n\ndisp('Hello, MATLAB!');\n`
      const matlabCode = code || matlabTemplate
      
      // Initialize code with MATLAB template if empty
      if (!code && !isPreviewMode) {
        onCodeChange(matlabTemplate)
      }
      
      return (
        <div className="space-y-4">
          <LockedBanner />
          
          {/* Code Editor for MATLAB */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
              📝 Your MATLAB Code
            </h4>
            <div
              className="border rounded-lg overflow-hidden"
              onContextMenu={!isPreviewMode ? (e) => e.preventDefault() : undefined}
            >
              <QuizAssessmentMonacoEditor
                height={monacoHeight}
                language="matlab"
                value={matlabCode}
                onMount={(editor) => {
                  editorRef.current = editor
                  // Restore cursor position if saved
                  try {
                    const posKey = `qpos_${question.id}`
                    const saved = sessionStorage.getItem(posKey)
                    if (saved) {
                      const parsed = JSON.parse(saved)
                      editor.setPosition(parsed)
                    }
                  } catch {}
                  
                  // Typing replay for anti-cheat
                  if (onTypingReplay) {
                    const model = editor.getModel()
                    if (model) {
                      model.onDidChangeContent((e) => {
                        const now = Date.now()
                        if (replayRef.current.events.length === 0) replayRef.current.startTime = now
                        const startTime = replayRef.current.startTime
                        const changes = [...(e.changes || [])].reverse()
                        for (const c of changes) {
                          const offset = (c as any).rangeOffset ?? 0
                          const rangeLength = (c as any).rangeLength ?? 0
                          const text = (c as any).text ?? ""
                          if (rangeLength > 0 && text.length === 0) {
                            replayRef.current.events.push({ t: now - startTime, op: "d", offset, text: "", len: rangeLength })
                          } else if (text.length > 0) {
                            if (rangeLength > 0) replayRef.current.events.push({ t: now - startTime, op: "d", offset, text: "", len: rangeLength })
                            replayRef.current.events.push({ t: now - startTime, op: "i", offset, text })
                          }
                        }
                        onTypingReplay({ ...replayRef.current })
                      })
                    }
                  }
                  
                  // Anti-cheat + mobile keyboard handling
                  editor.onKeyDown((e) => {
                    const ev = e.browserEvent
                    if (!isPreviewMode) {
                      const ctrlOrCmd = ev.ctrlKey || ev.metaKey
                      const key = e.keyCode
                      if (ctrlOrCmd && (key === 67 || key === 86 || key === 88)) {
                        ev.preventDefault()
                        ev.stopPropagation()
                        return
                      }
                    }
                    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent)
                    if (isMobile && e.keyCode === 13 && ev) {
                      ev.stopPropagation()
                    }
                  })
                }}
                onChange={(value) => {
                  const v = value || ""
                  // Log code edit
                  queueEvent("quiz", "codePlot", "CODE_EDIT", {
                    questionId: question.id,
                    questionType: questionType,
                    codeLength: v.length,
                    lineCount: v.split('\n').length
                  }, "info")
                  
                  // Update code immediately
                  onCodeChange(v)
                  
                  // Debounce cursor position saving
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  debounceRef.current = setTimeout(() => {
                    const pos = editorRef.current?.getPosition()
                    if (pos) {
                      editorRef.current?.setPosition(pos)
                      try { sessionStorage.setItem(`qpos_${question.id}`, JSON.stringify(pos)) } catch {}
                    }
                  }, 100)
                }}
                options={{
                  fontSize: 14,
                  automaticLayout: true,
                  formatOnType: false,
                  formatOnPaste: false,
                  tabSize: 2,
                  insertSpaces: true,
                  readOnly: isLocked || (showFeedback && !aiFeedback?.aiGraded),
                  contextmenu: isPreviewMode,
                  acceptSuggestionOnEnter: "off",
                  acceptSuggestionOnCommitCharacter: false,
                }}
              />
            </div>
            <AutoSaveCode code={code} questionId={question.id} />
          </div>

          {/* Plot Upload Section */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
              📊 Upload Your Plot/Graph
            </h4>
            <PlotUpload
              onUpload={onPlotUpload || (() => {})}
              onRemove={onPlotRemove || (() => {})}
              uploadedImage={uploadedPlot}
              disabled={isSubmittingAnswer}
              isLocked={isLocked}
            />
          </div>

          {/* Helpful Instructions */}
          {!uploadedPlot && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
                📌 Remember to upload your plot!
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Run your MATLAB code and generate the required plot</li>
                <li>Save the figure as an image (PNG or JPEG recommended)</li>
                <li>Upload the image using the upload area above</li>
                <li>AI will analyze both your code and plot for grading</li>
              </ul>
            </div>
          )}

          <AIFeedbackDisplay showFeedback={showFeedback} aiFeedback={aiFeedback} sampleAnswers={sampleAnswers} questionType={questionType} />
          <ExplainSection />
        </div>
      )

    case "fill_code":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-4 rounded-lg font-mono text-sm overflow-x-auto max-w-full text-slate-900 dark:text-slate-200" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <QuestionTextRenderer text={question.option_a || ""} className="whitespace-pre" />
          </div>
          <Input
            type="text"
            value={selectedAnswer || ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Fill in the missing code..."
            disabled={isSubmittingAnswer || isLocked}
            className="w-full font-mono text-foreground dark:text-slate-100 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50"
          />
          <ExplainSection />
        </div>
      )

    case "trace_logic":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-4 rounded-lg font-mono text-sm overflow-x-auto max-w-full text-slate-900 dark:text-slate-200" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <QuestionTextRenderer text={question.option_a || ""} className="whitespace-pre" />
          </div>
          <Input
            type="text"
            value={selectedAnswer || ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Enter traced variable values (e.g., x=5, y=10)..."
            disabled={isSubmittingAnswer || isLocked}
            className="w-full text-foreground dark:text-slate-100 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
          />
          <ExplainSection />
        </div>
      )

    case "scenario_match":
      const scenarioOptions = ["A", "B", "C", "D", "E"].filter((option) => {
        const optionKey = `option_${option.toLowerCase()}` as keyof Question
        return question[optionKey]
      })

      return (
        <div className="space-y-3">
          <LockedBanner />
          <p className="text-sm text-muted-foreground dark:text-slate-200 italic">Match the terms with their definitions:</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-semibold text-sm text-foreground dark:text-slate-200">Terms:</p>
              {scenarioOptions.map((option) => {
                const optionKey = `option_${option.toLowerCase()}` as keyof Question
                const optionText = question[optionKey] as string
                return (
                  <div key={option} className="p-3 border rounded-lg border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800">
                    <span className="font-semibold mr-2 text-foreground dark:text-slate-200">{option}.</span>
                    <span className="text-foreground dark:text-slate-200">{optionText}</span>
                  </div>
                )
              })}
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-sm text-foreground dark:text-slate-200">Your Matches:</p>
              <Textarea
                value={selectedAnswer || ""}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="Enter matches (e.g., A-1, B-3, C-2, D-4)..."
                rows={6}
                disabled={isSubmittingAnswer || isLocked}
                className="w-full text-foreground dark:text-slate-100 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <ExplainSection />
        </div>
      )

    case "code_reorder":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <p className="text-sm text-muted-foreground dark:text-slate-200 italic">Drag to reorder the code lines:</p>
          <div className="space-y-2">
            {reorderedLines.map((line, index) => (
              <div
                key={index}
                draggable={!showFeedback && !isSubmittingAnswer && !isLocked}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 border-2 rounded-lg border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 ${
                  showFeedback || isSubmittingAnswer || isLocked
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-move hover:border-primary/50"
                }`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground dark:text-slate-400 flex-shrink-0" />
                <span className="font-mono text-sm text-foreground dark:text-slate-200">{line}</span>
              </div>
            ))}
          </div>
          <ExplainSection />
        </div>
      )

    case "trace_output":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <Input
            type="text"
            value={selectedAnswer || ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Enter the final output..."
            disabled={isSubmittingAnswer || isLocked}
            className="w-full font-mono text-foreground dark:text-slate-100 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50"
          />
          <ExplainSection />
        </div>
      )

    case "debug_code":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-4 rounded-lg font-mono text-sm overflow-x-auto max-w-full text-slate-900 dark:text-slate-200" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <QuestionTextRenderer text={question.option_a || ""} className="whitespace-pre" />
          </div>
          <Textarea
            value={selectedAnswer || ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Describe the bug and how to fix it..."
            rows={6}
            disabled={isSubmittingAnswer || isLocked}
            className="w-full text-foreground dark:text-slate-100 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
          />
          <AIFeedbackDisplay showFeedback={showFeedback} aiFeedback={aiFeedback} sampleAnswers={sampleAnswers} questionType={questionType} />
          <ExplainSection />
        </div>
      )

    case "code_explain":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <Textarea
            value={selectedAnswer || ""}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Explain what this code does..."
            rows={8}
            disabled={isSubmittingAnswer || isLocked}
            className="w-full text-foreground dark:text-slate-100 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
          />
          <AIFeedbackDisplay showFeedback={showFeedback} aiFeedback={aiFeedback} sampleAnswers={sampleAnswers} questionType={questionType} />
          <ExplainSection />
        </div>
      )

    case "multi_part":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <MultiPartQuestionFields
            key={question.id}
            subquestionsRaw={question.subquestions}
            solutionUploadConfigRaw={question.solution_upload_config}
            selectedAnswer={selectedAnswer || ""}
            onAnswerChange={onAnswerChange}
            disabled={isSubmittingAnswer}
            locked={isLocked}
            showFeedback={showFeedback}
            attemptId={attemptId}
            questionId={question.id}
            studentDatabaseId={studentDatabaseId}
            onAntiCheatSuspendChange={onAntiCheatSuspendChange}
          />
          <AIFeedbackDisplay showFeedback={showFeedback} aiFeedback={aiFeedback} sampleAnswers={sampleAnswers} questionType={questionType} />
          <ExplainSection />
        </div>
      )

    case "circuit_submission":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <CircuitSubmissionFields
            question={question}
            selectedAnswer={selectedAnswer || ""}
            onAnswerChange={onAnswerChange}
            disabled={isSubmittingAnswer}
            locked={isLocked}
            attemptId={attemptId}
            questionId={question.id}
            studentDatabaseId={studentDatabaseId}
            onAntiCheatSuspendChange={onAntiCheatSuspendChange}
            answerSnapshotRef={circuitAnswerSnapshotRef}
            prepareSubmitRef={circuitPrepareSubmitRef}
          />
          <AIFeedbackDisplay
            showFeedback={showFeedback}
            aiFeedback={aiFeedback}
            sampleAnswers={sampleAnswers}
            questionType={questionType}
          />
          <ExplainSection />
        </div>
      )

    case "circuit_numeric":
    case "circuit_worked_solution":
    case "circuit_diagram_analysis":
    case "circuit_multi_part":
    case "circuit_fill_equation":
    case "circuit_transfer_function":
    case "circuit_phasor_power":
    case "circuit_transient_response":
    case "circuit_upload_work":
      return (
        <div className="space-y-3">
          <LockedBanner />
          <CircuitQuestionFields
            questionType={questionType}
            circuitSpecRaw={question.circuit_spec}
            selectedAnswer={selectedAnswer || ""}
            onAnswerChange={onAnswerChange}
            disabled={isSubmittingAnswer}
            locked={isLocked}
          />
          <AIFeedbackDisplay showFeedback={showFeedback} aiFeedback={aiFeedback} sampleAnswers={sampleAnswers} questionType={questionType} />
          <ExplainSection />
        </div>
      )

    default:
      return (
        <div className="text-muted-foreground dark:text-slate-300 italic">
          Unknown question type: {questionType}. Please contact your instructor.
        </div>
      )
  }
})

// Auto-save helper component to avoid re-renders in main tree
function AutoSaveCode({ code, questionId }: { code: string; questionId: number }) {
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(`code_answer_${questionId}`, code || "")
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [code, questionId])
  return null
}
