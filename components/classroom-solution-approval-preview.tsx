"use client"

import { useMemo } from "react"
import { CircuitSubmissionResultsDisplay } from "@/components/circuit-submission-results-display"
import { parseClassroomSolutionQuestionConfig } from "@/lib/classroom-solution-submission"

function answerJsonToSelectedAnswer(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === "string") return raw.trim() ? raw : null
  try {
    return JSON.stringify(raw)
  } catch {
    return null
  }
}

export function ClassroomSolutionApprovalPreview({
  assignmentQuestionConfig,
  solutionAnswerJson,
}: {
  assignmentQuestionConfig?: unknown
  solutionAnswerJson?: unknown
}) {
  const questionConfig = useMemo(
    () => parseClassroomSolutionQuestionConfig(assignmentQuestionConfig),
    [assignmentQuestionConfig],
  )
  const selectedAnswer = useMemo(
    () => answerJsonToSelectedAnswer(solutionAnswerJson),
    [solutionAnswerJson],
  )

  if (!selectedAnswer) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        No solution content was found for this submission.
      </p>
    )
  }

  return (
    <CircuitSubmissionResultsDisplay
      userType="instructor"
      question={{
        question_text: questionConfig?.question_text,
        question_media: questionConfig?.question_media,
        hint: questionConfig?.solution_upload_config?.title ?? null,
        solution_upload_config: questionConfig?.solution_upload_config,
        selected_answer: selectedAnswer,
      }}
    />
  )
}
