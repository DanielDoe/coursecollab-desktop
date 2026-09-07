/**
 * Server-side circuit workspace PNG export during student quiz finalize.
 * Used when the client cannot resolve studentDatabaseId or browser export fails.
 */

import { sql } from "@/lib/db"
import {
  compactCircuitSubmissionForAutoSave,
  mergeCircuitSubmissionForAutoSave,
  parseCircuitSubmissionAnswer,
  type CircuitSubmissionAnswer,
} from "@/lib/circuit-submission"
import { workspaceHasContent, type CircuitWorkspace } from "@/lib/circuit-workspace"
import { exportCircuitWorkspaceUploadsServer } from "@/lib/circuit-workspace-export-server"
import type { SolutionUploadsMap } from "@/lib/solution-upload"

export type StudentExportCircuitWorkspaceResult = {
  attemptId: number
  questionId: number
  exportedPages: number
  solutionUploads: SolutionUploadsMap
  answerJson: string
}

export async function exportCircuitWorkspaceForStudentAttempt(options: {
  attemptId: number
  questionId: number
  workspace: CircuitWorkspace
  title?: string
}): Promise<StudentExportCircuitWorkspaceResult> {
  const { attemptId, questionId, workspace, title } = options

  if (!workspaceHasContent(workspace)) {
    throw new Error("Workspace has no drawable content to export")
  }

  const [attemptRow] = await sql`
    SELECT student_id, completed_at
    FROM quiz_attempts
    WHERE id = ${attemptId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (!attemptRow) {
    throw new Error("Attempt not found")
  }

  const studentId = Number((attemptRow as { student_id: number }).student_id)
  if (!Number.isFinite(studentId) || studentId <= 0) {
    throw new Error("Invalid attempt owner")
  }

  const uploads = await exportCircuitWorkspaceUploadsServer({
    workspace,
    attemptId,
    questionId,
    studentDatabaseId: studentId,
    title,
  })
  if (Object.keys(uploads).length === 0) {
    throw new Error("Workspace export produced no images")
  }

  const [existing] = await sql`
    SELECT selected_answer, answer_data
    FROM quiz_answers
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
    LIMIT 1
  `

  const existingRaw =
    existing?.selected_answer != null && String(existing.selected_answer).trim() !== ""
      ? String(existing.selected_answer)
      : null

  const mergedAnswer: CircuitSubmissionAnswer = {
    ...parseCircuitSubmissionAnswer(existingRaw),
    version: 1,
    submission_mode: "workspace",
    workspace,
    solution_uploads: uploads,
    submission_status: "draft",
  }

  const answerJson =
    existingRaw != null
      ? mergeCircuitSubmissionForAutoSave(JSON.stringify(mergedAnswer), existingRaw)
      : compactCircuitSubmissionForAutoSave(mergedAnswer)

  const answerDataPatch = {
    answer: parseCircuitSubmissionAnswer(answerJson),
    questionType: "circuit_submission",
    autoSave: true,
    savedAt: new Date().toISOString(),
  }

  await sql`
    INSERT INTO quiz_answers (
      attempt_id, question_id, selected_answer, answer_data, answered_at,
      is_correct, points_earned, requires_review
    )
    VALUES (
      ${attemptId}, ${questionId}, ${answerJson}, ${JSON.stringify(answerDataPatch)}::jsonb, NOW(),
      false, 0, false
    )
    ON CONFLICT (attempt_id, question_id) DO UPDATE SET
      selected_answer = EXCLUDED.selected_answer,
      answer_data = EXCLUDED.answer_data,
      answered_at = NOW()
  `

  return {
    attemptId,
    questionId,
    exportedPages: Object.keys(uploads).length,
    solutionUploads: uploads,
    answerJson,
  }
}
