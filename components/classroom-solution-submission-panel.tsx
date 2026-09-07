"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CircuitSubmissionFields } from "@/components/circuit-submission-fields"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { useToast } from "@/components/ui/use-toast"
import type { ClassroomSolutionQuestionConfig } from "@/lib/classroom-solution-submission"
import {
  circuitSubmissionHasRequiredUpload,
  compactCircuitSubmissionForSubmit,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
} from "@/lib/circuit-submission"
import { exportCircuitWorkspaceUploads } from "@/lib/circuit-workspace-export"

const CLASSROOM_QUESTION_NUMERIC_ID = 1

type Props = {
  assignmentId: number
  studentId: number
  studentDatabaseId?: number | null
  questionConfig: ClassroomSolutionQuestionConfig
  disabled?: boolean
  onSubmitted?: () => void
}

function emptyAnswerJson(): string {
  return JSON.stringify({
    solution_uploads: {},
    workspace: null,
    submission_mode: "workspace",
  })
}

export function ClassroomSolutionSubmissionPanel({
  assignmentId,
  studentId,
  studentDatabaseId,
  questionConfig,
  disabled,
  onSubmitted,
}: Props) {
  const { toast } = useToast()
  const [answer, setAnswer] = useState(emptyAnswerJson)
  const [submitting, setSubmitting] = useState(false)
  const answerRef = useRef(answer)
  const prepareSubmitRef = useRef<(() => void | Promise<void>) | null>(null)
  const answerSnapshotRef = useRef<(() => string) | null>(null)
  answerRef.current = answer

  const uploadConfig = parseCircuitSubmissionConfig(questionConfig.solution_upload_config ?? null)
  const uploadEndpoint = "/api/student/classroom-points/solution-upload"
  const uploadExtraFields = { assignmentId: String(assignmentId) }

  const handleSubmit = useCallback(async () => {
    await prepareSubmitRef.current?.()
    let json = answerSnapshotRef.current?.() ?? answerRef.current

    let parsed = parseCircuitSubmissionAnswer(json)
    if (
      parsed.submission_mode === "workspace" &&
      parsed.workspace &&
      Object.keys(parsed.solution_uploads ?? {}).length === 0
    ) {
      if (!studentDatabaseId) {
        toast({
          title: "Cannot submit yet",
          description: "Student session not fully loaded. Refresh and try again.",
          variant: "destructive",
        })
        return
      }
      try {
        const uploads = await exportCircuitWorkspaceUploads({
          workspace: parsed.workspace,
          attemptId: assignmentId,
          questionId: CLASSROOM_QUESTION_NUMERIC_ID,
          studentDatabaseId,
          title: uploadConfig.title ?? questionConfig.question_text.slice(0, 80),
          uploadEndpoint,
          uploadExtraFields,
        })
        parsed = { ...parsed, solution_uploads: uploads, submission_status: "submitted" }
        json = JSON.stringify(parsed)
      } catch (e) {
        toast({
          title: "Workspace export failed",
          description: e instanceof Error ? e.message : "Could not save workspace pages",
          variant: "destructive",
        })
        return
      }
    }

    const compact = compactCircuitSubmissionForSubmit(json)
    if (!circuitSubmissionHasRequiredUpload(compact, uploadConfig)) {
      toast({
        title: "Solution required",
        description: "Upload a file, add a photo, or write in the workspace before submitting.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await studentApiFetch("/api/classroom-points/submit-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentAnswer: compact,
          studentId,
          submissionId: assignmentId,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        success?: boolean
        pointsAwarded?: number
        status?: string
        autoApproved?: boolean
        instructorFeedback?: string
        aiFeedback?: Record<string, unknown>
      }
      if (!res.ok) throw new Error(data.error || "Submit failed")
      toast({
        title: data.autoApproved ? "Solution submitted!" : "Solution submitted",
        description: data.autoApproved
          ? `${data.pointsAwarded ?? 2.5} provisional classroom points recorded (×${data.pointBooster ?? 1} booster). Your instructor will confirm the final score.`
          : data.instructorFeedback
            ? `Provisional AI feedback recorded — instructor review pending. ${data.instructorFeedback}`
            : `Pending instructor review — up to ${data.pointsAwarded ?? 2.5} classroom points when approved.`,
      })
      setAnswer(emptyAnswerJson())
      onSubmitted?.()
    } catch (e) {
      toast({
        title: "Submission failed",
        description: e instanceof Error ? e.message : "Could not submit",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }, [
    assignmentId,
    studentId,
    studentDatabaseId,
    uploadConfig,
    questionConfig.question_text,
    toast,
    onSubmitted,
  ])

  return (
    <div className="space-y-4">
      <QuestionMediaDisplay
        question={{ question_media: questionConfig.question_media }}
        size="default"
      />

      <div className="rounded-xl border border-slate-200/80 bg-white dark:bg-slate-900/60 p-4 sm:p-5">
        <QuestionTextRenderer
          text={questionConfig.question_text}
          className="text-sm sm:text-base leading-relaxed text-slate-900 dark:text-slate-50"
        />
      </div>

      <CircuitSubmissionFields
        question={{
          id: CLASSROOM_QUESTION_NUMERIC_ID,
          question_text: questionConfig.question_text,
          question_type: "circuit_submission",
          question_media: questionConfig.question_media,
          solution_upload_config: questionConfig.solution_upload_config,
        }}
        selectedAnswer={answer}
        onAnswerChange={setAnswer}
        attemptId={assignmentId}
        questionId={CLASSROOM_QUESTION_NUMERIC_ID}
        studentDatabaseId={studentDatabaseId ?? null}
        requireStudentDatabaseId
        uploadEndpoint={uploadEndpoint}
        uploadExtraFields={uploadExtraFields}
        hideQuestionHeader
        answerSnapshotRef={answerSnapshotRef}
        prepareSubmitRef={prepareSubmitRef}
        disabled={disabled || submitting}
      />

      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSubmit()} disabled={disabled || submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit for grading
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
