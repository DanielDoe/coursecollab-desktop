"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { CircuitWorkspaceExportQuestionButton } from "@/components/circuit-workspace-export-actions"
import {
  CIRCUIT_SUBMISSION_RUBRIC_KEYS,
  CIRCUIT_SUBMISSION_RUBRIC_LABELS,
  listCircuitSubmissionFiles,
  mergeCircuitSubmissionGrading,
  parseCircuitSubmissionConfig,
  resolveCircuitSubmissionInstructorGrading,
  effectiveCircuitOverridePoints,
  sumCircuitSubmissionRubricScores,
  type CircuitSubmissionRubricScores,
} from "@/lib/circuit-submission"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { FeedbackTextRenderer } from "@/components/question-text-renderer"
import type { FacultyResultsDetailTheme } from "@/lib/results/faculty-results-detail-ui"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

function emptyRubricScores(): CircuitSubmissionRubricScores {
  return { setup: null, method: null, calculations: null, final_answer: null }
}

type RubricKey = (typeof CIRCUIT_SUBMISSION_RUBRIC_KEYS)[number]

const RUBRIC_VISUAL_STYLES: Record<
  RubricKey,
  { card: string; label: string; score: string; track: string; bar: string; inputWrap: string }
> = {
  setup: {
    card: "bg-blue-50/90 dark:bg-blue-950/35 border border-blue-200/70 dark:border-blue-800/50",
    label: "text-blue-800 dark:text-blue-200",
    score: "text-blue-900 dark:text-blue-100",
    track: "bg-blue-100 dark:bg-blue-900/50",
    bar: "bg-blue-600 dark:bg-blue-400",
    inputWrap: "rounded-lg border border-blue-200/50 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20 px-2 py-1.5",
  },
  method: {
    card: "bg-violet-50/90 dark:bg-violet-950/35 border border-violet-200/70 dark:border-violet-800/50",
    label: "text-violet-800 dark:text-violet-200",
    score: "text-violet-900 dark:text-violet-100",
    track: "bg-violet-100 dark:bg-violet-900/50",
    bar: "bg-violet-600 dark:bg-violet-400",
    inputWrap: "rounded-lg border border-violet-200/50 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-950/20 px-2 py-1.5",
  },
  calculations: {
    card: "bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/70 dark:border-amber-800/50",
    label: "text-amber-900 dark:text-amber-200",
    score: "text-amber-950 dark:text-amber-100",
    track: "bg-amber-100 dark:bg-amber-900/50",
    bar: "bg-amber-600 dark:bg-amber-400",
    inputWrap: "rounded-lg border border-amber-200/50 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 px-2 py-1.5",
  },
  final_answer: {
    card: "bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200/70 dark:border-emerald-800/50",
    label: "text-emerald-800 dark:text-emerald-200",
    score: "text-emerald-900 dark:text-emerald-100",
    track: "bg-emerald-100 dark:bg-emerald-900/50",
    bar: "bg-emerald-600 dark:bg-emerald-400",
    inputWrap: "rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-2 py-1.5",
  },
}

export function CircuitSubmissionInstructorGradePanel({
  answerId,
  attemptId,
  questionId,
  pointsEarned,
  overridePoints,
  maxPoints,
  selectedAnswer,
  answerDataRaw,
  aiFeedbackRaw,
  solutionUploadConfigRaw,
  requiresReview,
  userType,
  onOverridden,
  onWorkspaceExported,
  portalTheme = null,
}: {
  answerId?: number
  attemptId?: string
  questionId?: number
  pointsEarned: number
  overridePoints?: number | null
  maxPoints: number
  selectedAnswer?: unknown
  answerDataRaw?: unknown
  aiFeedbackRaw?: unknown
  solutionUploadConfigRaw?: unknown
  requiresReview?: boolean
  userType?: "student" | "admin" | "instructor"
  onOverridden: () => void
  onWorkspaceExported?: () => void
  portalTheme?: FacultyResultsDetailTheme | null
}) {
  const config = useMemo(
    () => parseCircuitSubmissionConfig(solutionUploadConfigRaw),
    [solutionUploadConfigRaw],
  )
  const rubric = config.rubric
  const hasRubric = rubric != null && CIRCUIT_SUBMISSION_RUBRIC_KEYS.some((k) => (rubric[k] ?? 0) > 0)

  const grading = useMemo(
    () =>
      resolveCircuitSubmissionInstructorGrading({
        selectedAnswer,
        answerData: answerDataRaw,
        aiFeedback: aiFeedbackRaw,
        pointsEarned,
        overridePoints,
      }),
    [selectedAnswer, answerDataRaw, aiFeedbackRaw, pointsEarned, overridePoints],
  )

  const { parsed, rubricScores: initialRubric, suggestedScore, instructorFeedback: initialFeedback } =
    grading
  const effectiveOverride = effectiveCircuitOverridePoints(overridePoints, suggestedScore)
  const files = useMemo(() => listCircuitSubmissionFiles(parsed.solution_uploads), [parsed.solution_uploads])

  const [score, setScore] = useState(String(suggestedScore))
  const [feedback, setFeedback] = useState(initialFeedback)
  const [rubricScores, setRubricScores] = useState<CircuitSubmissionRubricScores>(
    initialRubric ?? emptyRubricScores(),
  )
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rubricSeedKey = JSON.stringify(initialRubric)
  const feedbackSeedKey = initialFeedback

  useEffect(() => {
    const manualScore =
      parsed.manual_score != null && parsed.manual_score > 0 ? parsed.manual_score : null
    const earned =
      effectiveOverride ??
      manualScore ??
      (pointsEarned != null && pointsEarned > 0 ? pointsEarned : null) ??
      suggestedScore ??
      0
    setScore(String(earned))
  }, [effectiveOverride, parsed.manual_score, pointsEarned, suggestedScore])

  useEffect(() => {
    setFeedback(feedbackSeedKey)
  }, [feedbackSeedKey])

  useEffect(() => {
    setRubricScores(initialRubric ?? emptyRubricScores())
  }, [rubricSeedKey, initialRubric])

  if (userType !== "instructor" && userType !== "admin") return null

  const maxPts = maxPoints || 10
  const rubricTotal = parseFloat(sumCircuitSubmissionRubricScores(rubricScores).toFixed(2))
  const previewScore = parseFloat(score)
  const previewScoreValid = !isNaN(previewScore) && previewScore >= 0
  const previewPercent =
    previewScoreValid && maxPts > 0 ? Math.round((previewScore / maxPts) * 100) : 0

  const updateRubricScore = (key: (typeof CIRCUIT_SUBMISSION_RUBRIC_KEYS)[number], raw: string) => {
    const maxForKey = rubric?.[key] ?? 0
    const val = raw === "" ? null : parseFloat(raw)
    const next = { ...rubricScores, [key]: val }
    if (val != null && (isNaN(val) || val < 0 || val > maxForKey)) return
    setRubricScores(next)
    if (hasRubric) {
      setScore(String(parseFloat(sumCircuitSubmissionRubricScores(next).toFixed(2))))
    }
  }

  const handleApply = async () => {
    if (!answerId && !(attemptId && questionId != null)) {
      setError("Missing answer row — refresh the page")
      return
    }
    const val = parseFloat(score)
    if (isNaN(val) || val < 0 || val > maxPts) {
      setError(`Enter 0–${maxPts}`)
      return
    }

    setIsApplying(true)
    setError(null)
    try {
      const adminId = sessionStorage.getItem("adminId")
      const instructorId =
        sessionStorage.getItem("instructorId") ||
        sessionStorage.getItem("instructorUsername") ||
        (adminId ? `admin:${adminId}` : "instructor")

      const gradingPayload = mergeCircuitSubmissionGrading(selectedAnswer ?? "{}", {
        manual_score: val,
        instructor_feedback: feedback.trim() || null,
        rubric_scores: hasRubric ? rubricScores : null,
        graded_by: instructorId,
        graded_at: new Date().toISOString(),
        submission_status: "graded",
      })

      const payload =
        answerId != null
          ? {
              answerId,
              pointsEarned: val,
              isCorrect: val >= maxPts * 0.5,
              circuitSubmissionGrading: gradingPayload,
            }
          : {
              attemptId: Number(attemptId),
              questionId,
              pointsEarned: val,
              isCorrect: val >= maxPts * 0.5,
              circuitSubmissionGrading: gradingPayload,
            }

      const res = await instructorApiFetch("/api/instructor/results/override-question-grade", {
        method: "POST",
        headers: adminId
          ? {
              ...buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
              "x-admin-id": adminId,
            }
          : buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      toast.success("Grade saved", { description: `${val}/${maxPts} pts applied` })
      onOverridden()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed"
      setError(msg)
      toast.error("Grading failed", { description: msg })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className={cn(portalTheme?.insetPanel ?? "mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30", "space-y-4")}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Circuit submission grading</p>
        {requiresReview ? (
          <span className="text-xs text-amber-700 dark:text-amber-300">Awaiting review</span>
        ) : null}
      </div>

      {files.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {files.length} file{files.length === 1 ? "" : "s"} submitted
          </p>
          <ul className="text-xs space-y-1">
            {files.map((f, i) => (
              <li key={`${f.url}-${i}`}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("underline truncate inline-block max-w-full", portalTheme ? "text-[var(--cc-text)]" : "text-indigo-600 dark:text-indigo-400")}
                >
                  {f.name || `File ${i + 1}`}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">No files uploaded.</p>
      )}

      <CircuitWorkspaceExportQuestionButton
        answerId={answerId}
        attemptId={attemptId}
        questionId={questionId}
        selectedAnswer={selectedAnswer}
        answerDataRaw={answerDataRaw}
        aiFeedbackRaw={aiFeedbackRaw}
        onExported={() => {
          onWorkspaceExported?.()
          onOverridden()
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor={`cs-feedback-${answerId ?? questionId}`} className="text-xs font-medium">
          Instructor feedback
        </Label>
        <Textarea
          id={`cs-feedback-${answerId ?? questionId}`}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={6}
          className="text-sm resize-y font-mono text-xs"
          placeholder="Feedback shown to the student (pre-filled from AI when available)…"
        />
      </div>

      {hasRubric && rubric ? (
        <div className="space-y-2 rounded-lg border border-slate-200/80 dark:border-slate-600/80 p-3 bg-white/50 dark:bg-slate-900/40">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">📊 Detailed Scoring</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Grading rubric — pre-filled from AI, adjust as needed
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {CIRCUIT_SUBMISSION_RUBRIC_KEYS.map((key) => {
              const maxForKey = rubric[key] ?? 0
              if (maxForKey <= 0) return null
              const style = RUBRIC_VISUAL_STYLES[key]
              return (
                <div key={key} className={`flex items-center gap-2 ${style.inputWrap}`}>
                  <Label className={`text-xs shrink-0 w-24 font-medium ${style.label}`}>
                    {CIRCUIT_SUBMISSION_RUBRIC_LABELS[key]}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={maxForKey}
                    step={0.25}
                    value={rubricScores[key] ?? ""}
                    onChange={(e) => updateRubricScore(key, e.target.value)}
                    className="h-8 text-sm w-20 bg-white/80 dark:bg-slate-900/60"
                  />
                  <span className={`text-xs font-medium ${style.label}`}>/ {maxForKey}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-600/60">
            Rubric total: <span className="font-semibold text-slate-800 dark:text-slate-200">{rubricTotal}</span> / {maxPts} pts
          </p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`cs-score-${answerId ?? questionId}`} className="text-xs">
            {hasRubric ? "Total score" : "Score"}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`cs-score-${answerId ?? questionId}`}
              type="number"
              min={0}
              max={maxPts}
              step={0.01}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-24 h-9 text-sm"
            />
            <span className="text-xs text-slate-500">/ {maxPts} pts</span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleApply} disabled={isApplying} className="sm:justify-self-start">
          {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4 mr-1" />}
          Save grade
        </Button>
      </div>

      <div className={cn(
        portalTheme?.studentPreviewPanel ?? "rounded-xl p-4 space-y-4 border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/30 dark:bg-indigo-950/20",
      )}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className={portalTheme?.mutedLabel ?? "text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200"}>
            Student preview
          </p>
          {previewScoreValid ? (
            <div className="text-right">
              <span className={cn("text-lg", portalTheme?.bodyStrong ?? "font-bold text-indigo-900 dark:text-indigo-100")}>
                {previewScore.toFixed(previewScore % 1 === 0 ? 0 : 2)}
              </span>
              <span className={cn("text-xs ml-1", portalTheme ? PORTAL_TEXT_MUTED : "text-indigo-700/80 dark:text-indigo-300/80")}>
                / {maxPts} pts ({previewPercent}%)
              </span>
            </div>
          ) : null}
        </div>

        {feedback.trim() ? (
          <div className={cn(
            portalTheme?.studentPreviewInset ?? "rounded-lg p-3 border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/50",
          )}>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Feedback</p>
            <FeedbackTextRenderer
              text={feedback}
              className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">No feedback text yet.</p>
        )}

        {hasRubric && rubric ? (
          <div className={cn(
            "space-y-3",
            portalTheme?.studentPreviewInset ?? "rounded-lg p-3 border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/50",
          )}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">📊 Detailed Scoring</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {CIRCUIT_SUBMISSION_RUBRIC_KEYS.map((key) => {
                const maxForKey = rubric[key] ?? 0
                if (maxForKey <= 0) return null
                const earned = Number(rubricScores[key] ?? 0)
                const pct = maxForKey > 0 ? Math.min(100, (earned / maxForKey) * 100) : 0
                const style = RUBRIC_VISUAL_STYLES[key]
                return (
                  <div key={key} className={`p-3 rounded-lg ${style.card}`}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className={`text-xs font-semibold ${style.label}`}>
                        {CIRCUIT_SUBMISSION_RUBRIC_LABELS[key]}
                      </span>
                      <span className={`text-sm font-bold shrink-0 ${style.score}`}>
                        {earned.toFixed(earned % 1 !== 0 ? 2 : 0)}/{maxForKey}
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2 overflow-hidden ${style.track}`}>
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${style.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className={cn("text-xs font-semibold text-slate-800 dark:text-slate-200 pt-1", portalTheme ? "" : "border-t border-slate-200/60 dark:border-slate-600/60")}>
              Total: {rubricTotal} / {maxPts} pts
            </p>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}
