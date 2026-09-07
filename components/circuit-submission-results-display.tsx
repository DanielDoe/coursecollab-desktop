"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import { FeedbackTextRenderer, QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import {
  listCircuitSubmissionFiles,
  parseCircuitSubmissionAnswerMerged,
  parseCircuitSubmissionConfig,
  resolveCircuitSubmissionProvisionalScore,
  isCircuitSubmissionProvisional,
  type CircuitSubmissionStatus,
} from "@/lib/circuit-submission"
import { CircuitProvisionalStudentNotice } from "@/components/circuit-provisional-student-notice"
import { workspaceHasContent } from "@/lib/circuit-workspace"
import { workspaceReplayHasEvents } from "@/lib/workspace-replay"
import { WorkspaceReplayViewer } from "@/components/workspace-replay-viewer"
import { SolutionUploadPreview } from "@/components/solution-upload-preview"

const STATUS_LABEL: Record<CircuitSubmissionStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  graded: "Graded",
  returned: "Returned",
}

export function CircuitSubmissionResultsDisplay({
  question,
  userType = "student",
}: {
  question: {
    question_text?: string
    question_media?: unknown
    hint?: string | null
    solution_upload_config?: unknown
    selected_answer?: string | null
    answer_data?: unknown
    requires_review?: boolean
    override_points?: number | null
    reviewed_at?: string | null
    ai_feedback?: unknown
    max_points?: number
    points?: number
  }
  userType?: "student" | "admin" | "instructor"
}) {
  const config = useMemo(
    () => parseCircuitSubmissionConfig(question.solution_upload_config),
    [question.solution_upload_config],
  )

  const parsed = useMemo(
    () =>
      parseCircuitSubmissionAnswerMerged(question.selected_answer, question.answer_data),
    [question.selected_answer, question.answer_data],
  )

  const [replayOpen, setReplayOpen] = useState(false)
  const files = listCircuitSubmissionFiles(parsed.solution_uploads)
  const usedWorkspace = parsed.submission_mode === "workspace" || workspaceHasContent(parsed.workspace)
  const hasReplay = workspaceReplayHasEvents(parsed.workspace_replay)
  const title = config.title || question.hint?.trim() || null
  const status =
    question.override_points != null
      ? "graded"
      : parsed.submission_status ?? (files.length > 0 ? "submitted" : "not_started")

  const isInstructorView = userType === "instructor" || userType === "admin"
  const studentFeedback = parsed.instructor_feedback?.trim() ?? ""
  const provisionalScore = resolveCircuitSubmissionProvisionalScore(question)
  const isProvisional = isCircuitSubmissionProvisional(question)
  const maxPts = Number(question.max_points ?? question.points ?? 10) || 10

  return (
    <div className="space-y-4">
      {title ? (
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      ) : null}

      <QuestionMediaDisplay question={{ question_media: question.question_media }} size="compact" />

      {question.question_text ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/80 p-4 bg-slate-50/50 dark:bg-slate-900/30">
          <QuestionTextRenderer text={question.question_text} className="text-sm leading-relaxed" />
        </div>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400">Status:</span>
        <Badge variant="secondary" className="text-xs">
          {STATUS_LABEL[status] ?? status}
        </Badge>
        {question.reviewed_at ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Graded {new Date(question.reviewed_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      {usedWorkspace ? (
        <Badge variant="outline" className="text-xs text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700">
          Submitted via workspace
        </Badge>
      ) : null}

      {usedWorkspace ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workspace Replay</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hasReplay
                  ? "Watch how the student built their solution in the notebook"
                  : "No workspace activity was recorded"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplayOpen(true)}
              className="gap-2"
              disabled={!hasReplay}
            >
              <Play className="h-4 w-4" />
              Play Workspace Replay
            </Button>
          </div>
        </div>
      ) : null}

      <WorkspaceReplayViewer
        open={replayOpen}
        onOpenChange={setReplayOpen}
        replay={parsed.workspace_replay}
      />

      {!isInstructorView && isProvisional ? (
        <CircuitProvisionalStudentNotice
          previewScore={provisionalScore}
          maxPoints={maxPts}
        />
      ) : null}

      {files.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            {usedWorkspace ? "Workspace pages" : "Uploaded work"} ({files.length})
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {files.map((file, i) => (
              <SolutionUploadPreview
                key={`${file.url}-${i}`}
                upload={file}
                uploads={files}
                index={i}
                pageLabel={
                  files.length > 1
                    ? `${usedWorkspace ? "Workspace page" : "Page"} ${i + 1}${file.name ? ` — ${file.name}` : ""}`
                    : file.name
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-amber-700 dark:text-amber-300">No solution files uploaded.</p>
      )}

      {!isInstructorView && studentFeedback ? (
        <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-2">
          <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200 mb-2">
            {isProvisional ? "AI feedback (preview — for learning only)" : "Feedback"}
          </p>
          <FeedbackTextRenderer
            text={studentFeedback}
            className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
          />
        </div>
      ) : !isInstructorView && question.requires_review && files.length > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Your submission is awaiting grading. Feedback will appear here once your instructor has reviewed it.
        </p>
      ) : null}
    </div>
  )
}
