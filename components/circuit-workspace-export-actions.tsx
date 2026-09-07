"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ImageDown } from "lucide-react"
import { toast } from "@/lib/app-toast"
import {
  listCircuitSubmissionFiles,
  parseCircuitSubmissionAnswerMerged,
} from "@/lib/circuit-submission"
import { circuitSubmissionNeedsWorkspaceExport } from "@/lib/circuit-submission-workspace-export-ui"
import { workspaceHasContent } from "@/lib/circuit-workspace"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

async function postExportWorkspace(body: Record<string, unknown>) {
  const adminId = sessionStorage.getItem("adminId")
  const res = await instructorApiFetch("/api/instructor/export-workspace-submission", {
    method: "POST",
    headers: adminId
      ? {
          ...buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
          "x-admin-id": adminId,
        }
      : buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

export function CircuitWorkspaceExportQuestionButton({
  answerId,
  attemptId,
  questionId,
  selectedAnswer,
  answerDataRaw,
  aiFeedbackRaw,
  onExported,
  size = "sm",
}: {
  answerId?: number
  attemptId?: string
  questionId?: number
  selectedAnswer?: unknown
  answerDataRaw?: unknown
  aiFeedbackRaw?: unknown
  onExported: () => void
  size?: "sm" | "default"
}) {
  const [isExporting, setIsExporting] = useState(false)

  const parsed = useMemo(
    () => parseCircuitSubmissionAnswerMerged(selectedAnswer, answerDataRaw),
    [selectedAnswer, answerDataRaw],
  )
  const files = useMemo(() => listCircuitSubmissionFiles(parsed.solution_uploads), [parsed.solution_uploads])
  const hasWorkspaceInk = workspaceHasContent(parsed.workspace)
  const needsExport = circuitSubmissionNeedsWorkspaceExport(
    selectedAnswer,
    answerDataRaw,
    aiFeedbackRaw,
  )

  if (!needsExport && files.length > 0) return null

  const canTarget = answerId != null || (attemptId && questionId != null)
  if (!canTarget) return null

  const handleExport = async () => {
    if (!canTarget) return
    setIsExporting(true)
    try {
      const body =
        answerId != null
          ? { answerId, reGrade: true }
          : { attemptId: Number(attemptId), questionId, reGrade: true }
      const data = await postExportWorkspace(body)
      toast.success("Workspace exported", { description: data.message || "Images saved for grading." })
      onExported()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed"
      toast.error("Workspace export failed", { description: msg })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
      <p className="text-xs text-amber-900 dark:text-amber-100">
        {hasWorkspaceInk
          ? "Workspace ink was saved but PNG pages were never exported for grading."
          : "This submission is missing export images. If workspace ink was lost, ask the student to re-save from the exam."}
      </p>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={handleExport}
        disabled={isExporting || !hasWorkspaceInk}
        className="gap-2 border-amber-300 dark:border-amber-700"
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
        Export workspace for grading
      </Button>
    </div>
  )
}

export function CircuitWorkspaceExportAttemptButton({
  attemptId,
  questions,
  onExported,
}: {
  attemptId: string
  questions: Array<{
    answer_id?: number | null
    question_id?: number
    question_type?: string
    selected_answer?: unknown
    answer_data?: unknown
    ai_feedback?: unknown
  }>
  onExported: () => void
}) {
  const [isExporting, setIsExporting] = useState(false)

  const missingCount = useMemo(
    () =>
      questions.filter((q) => {
        if ((q.question_type || "").toLowerCase() !== "circuit_submission") return false
        return circuitSubmissionNeedsWorkspaceExport(q.selected_answer, q.answer_data, q.ai_feedback)
      }).length,
    [questions],
  )

  if (missingCount === 0) return null

  const handleExportAll = async () => {
    setIsExporting(true)
    try {
      const data = await postExportWorkspace({
        attemptId: Number(attemptId),
        allForAttempt: true,
        reGrade: true,
      })
      const exported = Array.isArray(data.processed) ? data.processed.length : 0
      const failed = Array.isArray(data.failed) ? data.failed.length : 0
      if (exported > 0) {
        toast.success("Workspace exports complete", {
          description: `${exported} question(s) exported${failed > 0 ? `, ${failed} failed` : ""}.`,
        })
      } else if (failed > 0) {
        toast.error("Export failed", { description: data.message || `${failed} question(s) could not be exported.` })
      } else {
        toast.info("Nothing to export", { description: data.message })
      }
      onExported()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed"
      toast.error("Batch export failed", { description: msg })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExportAll}
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
      Export missing workspace ({missingCount})
    </Button>
  )
}
