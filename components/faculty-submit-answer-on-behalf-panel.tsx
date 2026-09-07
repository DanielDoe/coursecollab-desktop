"use client"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, ChevronDown, ChevronUp, UserCheck } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { CircuitSubmissionSolution } from "@/components/circuit-submission-solution"
import { MultiPartQuestionFields } from "@/components/multi-part-question-fields"
import {
  buildCircuitSubmissionConfig,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
  type CircuitSubmissionConfig,
} from "@/lib/circuit-submission"
import { createEmptyWorkspace } from "@/lib/circuit-workspace"
import { parseMultiPartStudentAnswer, getGradableSubquestions } from "@/lib/multi-part-question"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { SolutionUploadsMap } from "@/lib/solution-upload"

const INSTRUCTOR_UPLOAD = "/api/instructor/quiz-solution-upload"

function parseAnswerDataCode(raw: unknown): string {
  if (!raw) return ""
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (typeof o.code === "string") return o.code
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as Record<string, unknown>
      if (typeof p.code === "string") return p.code
    } catch {
      return raw
    }
  }
  return ""
}

function parseAnswerDataPlot(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (typeof o.plotImage === "string" && o.plotImage.trim()) return o.plotImage
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as Record<string, unknown>
      if (typeof p.plotImage === "string" && p.plotImage.trim()) return p.plotImage
    } catch {
      /* ignore */
    }
  }
  return null
}

export function FacultySubmitAnswerOnBehalfPanel({
  attemptId,
  questionId,
  questionType,
  selectedAnswer,
  answerDataRaw,
  solutionUploadConfigRaw,
  subquestionsRaw,
  userType,
  onSaved,
}: {
  attemptId?: string
  questionId?: number
  questionType?: string
  selectedAnswer?: unknown
  answerDataRaw?: unknown
  solutionUploadConfigRaw?: unknown
  subquestionsRaw?: unknown
  userType?: "student" | "admin" | "instructor"
  onSaved: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState("")
  const [triggerReEval, setTriggerReEval] = useState(true)

  const qt = (questionType || "").toLowerCase()
  const supported = qt === "circuit_submission" || qt === "multi_part" || qt === "code_write_plot"

  const uploadHeaders = useMemo(() => buildInstructorAuthorizedApiHeaders(), [])
  const attemptNum = attemptId ? Number(attemptId) : null

  const circuitConfig = useMemo(
    () => buildCircuitSubmissionConfig(parseCircuitSubmissionConfig(solutionUploadConfigRaw)),
    [solutionUploadConfigRaw],
  )

  const initialCircuit = useMemo(
    () => parseCircuitSubmissionAnswer(selectedAnswer ?? answerDataRaw),
    [selectedAnswer, answerDataRaw],
  )
  const [circuitUploads, setCircuitUploads] = useState<SolutionUploadsMap>(
    () => initialCircuit.solution_uploads ?? {},
  )

  const subquestions = useMemo(() => getGradableSubquestions(subquestionsRaw), [subquestionsRaw])
  const initialMultiPart = useMemo(() => {
    const raw =
      typeof selectedAnswer === "string"
        ? selectedAnswer
        : selectedAnswer != null
          ? JSON.stringify(selectedAnswer)
          : typeof answerDataRaw === "string"
            ? answerDataRaw
            : answerDataRaw != null
              ? JSON.stringify(answerDataRaw)
              : "{}"
    return JSON.stringify(parseMultiPartStudentAnswer(raw, subquestions))
  }, [selectedAnswer, answerDataRaw, subquestions])
  const [multiPartAnswer, setMultiPartAnswer] = useState(initialMultiPart)

  const [code, setCode] = useState(() => {
    const fromData = parseAnswerDataCode(answerDataRaw)
    if (fromData) return fromData
    if (typeof selectedAnswer === "string") {
      if (selectedAnswer.trim().startsWith("{")) {
        try {
          const p = JSON.parse(selectedAnswer) as { code?: string }
          if (typeof p.code === "string") return p.code
        } catch {
          /* ignore */
        }
      }
      return selectedAnswer
    }
    return ""
  })
  const [plotImage, setPlotImage] = useState<string | null>(() => {
    const fromData = parseAnswerDataPlot(answerDataRaw)
    if (fromData) return fromData
    if (typeof selectedAnswer === "string" && selectedAnswer.trim().startsWith("{")) {
      try {
        const p = JSON.parse(selectedAnswer) as { plotImage?: string }
        if (typeof p.plotImage === "string" && p.plotImage.trim()) return p.plotImage
      } catch {
        /* ignore */
      }
    }
    return null
  })
  const [plotUploading, setPlotUploading] = useState(false)

  const handlePlotFile = useCallback(async (file: File | null) => {
    if (!file) return
    setPlotUploading(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result ?? ""))
        reader.onerror = () => reject(new Error("Could not read plot image"))
        reader.readAsDataURL(file)
      })
      setPlotImage(dataUrl)
      toast.success("Plot image attached")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plot upload failed")
    } finally {
      setPlotUploading(false)
    }
  }, [])

  const runReEvaluate = async (answerId?: number) => {
    const isCodeQuestion =
      qt.includes("code") || qt === "code_write_plot"
    const body =
      answerId != null
        ? { answerId, forceAI: isCodeQuestion }
        : { attemptId: attemptNum, questionId, forceAI: isCodeQuestion }
    const res = await instructorApiFetch("/api/instructor/re-evaluate-answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...uploadHeaders,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Re-evaluation failed")
    return data as { pointsEarned?: number; maxPoints?: number }
  }

  const handleSave = async () => {
    if (!attemptNum || !questionId) {
      toast.error("Missing attempt or question")
      return
    }

    let answerPayload: string
    let plotPayload: string | undefined

    if (qt === "circuit_submission") {
      const fileCount = Object.values(circuitUploads).filter((a) => a?.url?.trim()).length
      if (fileCount === 0) {
        toast.error("Attach at least one solution file before saving")
        return
      }
      answerPayload = JSON.stringify({
        version: 1,
        submission_status: "submitted",
        submission_mode: "upload",
        solution_uploads: circuitUploads,
      })
    } else if (qt === "multi_part") {
      answerPayload = multiPartAnswer
    } else {
      if (!code.trim()) {
        toast.error("Enter the student's code before saving")
        return
      }
      answerPayload = code
      plotPayload = plotImage ?? undefined
    }

    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/submit-answer-on-behalf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...uploadHeaders,
        },
        body: JSON.stringify({
          attemptId: attemptNum,
          questionId,
          questionType: qt,
          answer: answerPayload,
          plotImage: plotPayload,
          reason: reason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")

      toast.success("Answer saved on behalf of student")

      if (triggerReEval) {
        try {
          const reEval = await runReEvaluate(data.answerId as number | undefined)
          const pts = reEval?.pointsEarned
          const max = reEval?.maxPoints
          toast.success(
            pts != null && max != null
              ? `Re-evaluation complete — ${pts}/${max} pts`
              : "Re-evaluation complete",
          )
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Saved, but re-evaluation failed — use Re-evaluate manually",
          )
        }
      }

      onSaved()
      setExpanded(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save answer")
    } finally {
      setSaving(false)
    }
  }

  if (userType !== "instructor" && userType !== "admin") return null
  if (!supported || !attemptNum || !questionId) return null

  return (
    <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
          <UserCheck className="h-4 w-4 shrink-0" />
          Submit answer on behalf of student
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
        )}
      </button>

      {expanded ? (
        <div className="px-4 pb-4 space-y-4 border-t border-amber-200/60 dark:border-amber-800/40 pt-4">
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
            Use when the student&apos;s submission failed due to a technical issue. Upload or enter their
            work, then save. Grading runs automatically if re-evaluate is checked.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor={`behalf-reason-${questionId}`} className="text-xs">
              Reason (optional, stored for audit)
            </Label>
            <Textarea
              id={`behalf-reason-${questionId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Browser crash during submit; student emailed PDF"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {qt === "circuit_submission" ? (
            <CircuitSubmissionSolution
              config={circuitConfig as CircuitSubmissionConfig}
              uploads={circuitUploads}
              onUploadsChange={setCircuitUploads}
              submissionMode="upload"
              onSubmissionModeChange={() => {}}
              workspace={createEmptyWorkspace()}
              onWorkspaceChange={() => {}}
              attemptId={attemptNum}
              questionId={questionId}
              uploadEndpoint={INSTRUCTOR_UPLOAD}
              uploadHeaders={uploadHeaders}
              requireStudentDatabaseId={false}
              recoveryMode
            />
          ) : null}

          {qt === "multi_part" ? (
            <MultiPartQuestionFields
              subquestionsRaw={subquestionsRaw}
              solutionUploadConfigRaw={solutionUploadConfigRaw}
              selectedAnswer={multiPartAnswer}
              onAnswerChange={setMultiPartAnswer}
              attemptId={attemptNum}
              questionId={questionId}
              uploadEndpoint={INSTRUCTOR_UPLOAD}
              uploadHeaders={uploadHeaders}
              requireStudentDatabaseId={false}
            />
          ) : null}

          {qt === "code_write_plot" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`behalf-code-${questionId}`} className="text-xs font-semibold">
                  Student code
                </Label>
                <Textarea
                  id={`behalf-code-${questionId}`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  placeholder="Paste the student's code here"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Plot image (if required)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={plotUploading} asChild>
                    <label className="cursor-pointer">
                      {plotUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1.5" />
                      )}
                      Upload plot
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => void handlePlotFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </Button>
                  {plotImage ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPlotImage(null)}>
                      Remove plot
                    </Button>
                  ) : null}
                </div>
                {plotImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={plotImage}
                    alt="Student plot preview"
                    className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={triggerReEval}
              onChange={(e) => setTriggerReEval(e.target.checked)}
              className="rounded border-slate-300"
            />
            Run re-evaluation after saving
          </label>

          <Button type="button" onClick={() => void handleSave()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Save on behalf of student
          </Button>
        </div>
      ) : null}
    </div>
  )
}
