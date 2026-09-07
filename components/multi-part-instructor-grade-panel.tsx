"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "@/lib/app-toast"
import {
  buildUploadRubricScores,
  parseMultiPartGradingFromAnswerData,
  computeMcqPointsEarned,
  deriveMultiPartGradingPolicy,
  buildMultiPartGradingBreakdown,
  multiPartGradingBreakdownToAnswerData,
} from "@/lib/multi-part-grading-policy"
import { unwrapStudentAnswerForGrading } from "@/lib/solution-upload"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

function parseAnswerData(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "object") return raw as Record<string, unknown>
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

export function MultiPartInstructorGradePanel({
  answerId,
  attemptId,
  questionId,
  pointsEarned,
  overridePoints,
  maxPoints,
  answerDataRaw,
  selectedAnswer,
  subquestionsRaw,
  solutionUploadConfigRaw,
  requiresReview,
  userType,
  onOverridden,
}: {
  answerId?: number
  attemptId?: string
  questionId?: number
  pointsEarned: number
  overridePoints?: number | null
  maxPoints: number
  answerDataRaw?: unknown
  selectedAnswer?: unknown
  subquestionsRaw?: unknown
  solutionUploadConfigRaw?: unknown
  requiresReview?: boolean
  userType?: "student" | "admin" | "instructor"
  onOverridden: () => void
}) {
  const policy = useMemo(
    () => deriveMultiPartGradingPolicy(subquestionsRaw, solutionUploadConfigRaw),
    [subquestionsRaw, solutionUploadConfigRaw],
  )

  const storedBreakdown = useMemo(() => {
    const ad = parseAnswerData(answerDataRaw)
    return ad ? parseMultiPartGradingFromAnswerData(ad) : null
  }, [answerDataRaw])

  const mcqEarned = useMemo(() => {
    if (storedBreakdown) return storedBreakdown.mcq_earned
    const studentAnswer =
      selectedAnswer ??
      (() => {
        const ad = parseAnswerData(answerDataRaw)
        return ad
      })()
    return computeMcqPointsEarned(policy, subquestionsRaw, studentAnswer)
  }, [storedBreakdown, policy, subquestionsRaw, selectedAnswer, answerDataRaw])

  const effectiveTotal = overridePoints ?? pointsEarned ?? 0
  const uploadEarnedFromOverride =
    overridePoints != null ? Math.max(0, parseFloat((overridePoints - mcqEarned).toFixed(2))) : null
  const uploadEarned =
    uploadEarnedFromOverride ??
    (storedBreakdown?.upload_earned != null ? storedBreakdown.upload_earned : null)
  const uploadPending =
    requiresReview && uploadEarned == null && storedBreakdown?.upload_pending !== false

  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (userType !== "instructor" && userType !== "admin") return null

  const mcqMax = policy.mcq_total_points
  const uploadMax = policy.upload_total_points
  const totalMax = maxPoints || policy.total_points

  const rubricScores = useMemo(() => buildUploadRubricScores(uploadMax), [uploadMax])

  const displayUpload =
    uploadEarned != null ? uploadEarned : uploadPending ? null : 0
  const displayTotal =
    displayUpload != null ? parseFloat((mcqEarned + displayUpload).toFixed(2)) : mcqEarned

  const applyUploadScore = async (score: number) => {
    if (!answerId && !(attemptId && questionId != null)) {
      setError("Missing answer row — refresh the page")
      return
    }
    const clamped = Math.min(uploadMax, Math.max(0, score))
    const finalPoints = parseFloat((mcqEarned + clamped).toFixed(2))
    if (finalPoints > totalMax + 1e-4) {
      setError(`Total cannot exceed ${totalMax}`)
      return
    }

    setIsApplying(true)
    setError(null)
    try {
      const studentAnswer =
        selectedAnswer ??
        parseAnswerData(answerDataRaw) ??
        unwrapStudentAnswerForGrading(selectedAnswer, "multi_part").gradable
      const breakdown = buildMultiPartGradingBreakdown(
        policy,
        subquestionsRaw,
        studentAnswer,
        clamped,
        false,
      )
      const gradingPayload = multiPartGradingBreakdownToAnswerData(breakdown)

      const payload =
        answerId != null
          ? {
              answerId,
              pointsEarned: finalPoints,
              solutionUploadScore: clamped,
              multiPartGrading: gradingPayload.multi_part_grading,
            }
          : {
              attemptId: Number(attemptId),
              questionId,
              pointsEarned: finalPoints,
              solutionUploadScore: clamped,
              multiPartGrading: gradingPayload.multi_part_grading,
            }

      const adminId = sessionStorage.getItem("adminId")
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
      toast.success("Solution graded", {
        description: `Final score: ${finalPoints.toFixed(2)} / ${totalMax.toFixed(2)}`,
      })
      onOverridden()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-4 space-y-4">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Multi-part grading breakdown
      </p>
      <p className="text-xs text-slate-500">
        {policy.part_count} parts · upload multiplier ×{policy.upload_points_multiplier}
      </p>

      <div className="grid gap-2 text-sm font-mono">
        <div className="flex justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">MCQ Score</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {mcqEarned.toFixed(2)} / {mcqMax.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Uploaded Solution</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {displayUpload != null ? displayUpload.toFixed(2) : "—"} / {uploadMax.toFixed(2)}
            {uploadPending ? (
              <span className="ml-2 text-xs font-sans text-amber-600 dark:text-amber-400">
                pending review
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-200 dark:border-slate-600 pt-2">
          <span className="text-slate-700 dark:text-slate-300 font-sans font-medium">Final Score</span>
          <span className="font-bold text-indigo-700 dark:text-indigo-300">
            {(overridePoints ?? displayTotal).toFixed(2)} / {totalMax.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-400">Upload rubric (quick grade)</p>
        <div className="flex flex-wrap gap-2">
          {rubricScores.map((score) => (
            <Button
              key={score}
              type="button"
              size="sm"
              variant={uploadEarned === score ? "default" : "outline"}
              disabled={isApplying}
              onClick={() => applyUploadScore(score)}
              className="min-w-[3rem] font-mono"
            >
              {score}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          100% · 75% · 50% · 25% · 0% of upload max ({uploadMax.toFixed(2)} pts)
        </p>
      </div>

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {isApplying ? (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      ) : null}
    </div>
  )
}
