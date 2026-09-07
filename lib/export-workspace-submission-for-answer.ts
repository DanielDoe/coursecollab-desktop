/**
 * Export saved workspace ink to PNG uploads for grading (instructor recovery).
 */

import { sql } from "@/lib/db"
import {
  circuitSubmissionFileCount,
  compactCircuitSubmissionForSubmit,
  parseCircuitSubmissionAnswerMerged,
  resolveCircuitSubmissionForGrading,
} from "@/lib/circuit-submission"
import { workspaceHasContent } from "@/lib/circuit-workspace"
import { exportCircuitWorkspaceUploadsServer } from "@/lib/circuit-workspace-export-server"
import { circuitSubmissionNeedsWorkspaceExport } from "@/lib/circuit-submission-workspace-export-ui"
import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import { tryAutoFinalizePerfectScore } from "@/lib/auto-finalize-perfect-scores"
import { resolveAwardedPointsForAiSubmission } from "@/lib/ai-points-consistency"

export type ExportWorkspaceSubmissionResult = {
  answerId: number
  attemptId: number
  questionId: number
  exportedPages: number
  reGraded: boolean
  pointsEarned?: number
  message: string
}

export { circuitSubmissionNeedsWorkspaceExport } from "@/lib/circuit-submission-workspace-export-ui"

type AnswerRow = {
  answer_id: number
  attempt_id: number
  question_id: number
  quiz_id: number
  student_id: number
  selected_answer: string | null
  answer_data: unknown
  question_text: string | null
  question_type: string | null
  solution_upload_config: unknown
  question_media: unknown
  expected_answer: string | null
  hint: string | null
  max_points: number | null
  question_points: number | null
}

async function loadAnswerRow(answerId: number): Promise<AnswerRow | null> {
  const rows = await sql`
    SELECT
      qa.id AS answer_id,
      qa.attempt_id,
      qa.question_id,
      att.quiz_id,
      att.student_id,
      qa.selected_answer,
      qa.answer_data,
      qq.question_text,
      qq.question_type,
      qq.solution_upload_config,
      qq.question_media,
      qq.expected_answer,
      qq.hint,
      qq.max_points,
      qq.points AS question_points
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    JOIN quiz_questions qq ON qq.id = qa.question_id
    WHERE qa.id = ${answerId}
    LIMIT 1
  `
  return (rows[0] as AnswerRow | undefined) ?? null
}

export async function exportWorkspaceSubmissionForAnswer(options: {
  answerId: number
  reGrade?: boolean
  instructorId?: string
}): Promise<ExportWorkspaceSubmissionResult> {
  const row = await loadAnswerRow(options.answerId)
  if (!row) {
    throw new Error("Answer not found")
  }
  if ((row.question_type || "").toLowerCase() !== "circuit_submission") {
    throw new Error("Not a circuit submission question")
  }

  const parsed = resolveCircuitSubmissionForGrading(row.selected_answer, row.answer_data)
  const existingFiles = circuitSubmissionFileCount(parsed.solution_uploads)
  const hasWorkspace =
    parsed.submission_mode === "workspace" && workspaceHasContent(parsed.workspace)

  if (existingFiles > 0 && !options.reGrade) {
    return {
      answerId: row.answer_id,
      attemptId: row.attempt_id,
      questionId: row.question_id,
      exportedPages: existingFiles,
      reGraded: false,
      message: "Solution files already exist — use Re-evaluate to refresh grading.",
    }
  }

  if (!hasWorkspace || !parsed.workspace) {
    throw new Error(
      "No saved workspace ink found for this answer. The student must re-open the question and tap Save to submission.",
    )
  }

  const uploads = await exportCircuitWorkspaceUploadsServer({
    workspace: parsed.workspace,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    studentDatabaseId: row.student_id,
    title: row.hint ?? undefined,
  })

  if (Object.keys(uploads).length === 0) {
    throw new Error("Workspace export produced no images (empty pages).")
  }

  const merged = {
    ...parsed,
    solution_uploads: uploads,
    submission_status: "submitted" as const,
  }
  const compactJson = compactCircuitSubmissionForSubmit(merged)

  let pointsEarned: number | undefined
  let aiFeedbackJson: string | null = null
  let evaluationFeedback: string | null = null
  let isCorrect = false
  let requiresReview = true
  let reGraded = false

  if (options.reGrade !== false) {
    let evaluationMode = "standard"
    try {
      const [quizRow] = await sql`
        SELECT COALESCE(NULLIF(TRIM(ai_evaluation_mode), ''),
          CASE
            WHEN LOWER(COALESCE(assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
            WHEN LOWER(COALESCE(assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
            WHEN LOWER(COALESCE(assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
            ELSE 'standard'
          END
        ) AS ai_evaluation_mode
        FROM quizzes WHERE id = ${row.quiz_id}
      `
      evaluationMode = (quizRow as { ai_evaluation_mode?: string })?.ai_evaluation_mode || "standard"
    } catch {
      /* keep default */
    }

    const maxPts = row.max_points || row.question_points || 10
    const graded = await gradeCircuitSubmissionAnswer(
      {
        question_text: row.question_text ?? undefined,
        question_media: row.question_media,
        solution_upload_config: row.solution_upload_config,
        expected_answer: row.expected_answer,
        hint: row.hint,
      },
      compactJson,
      {
        aiEvaluationMode: evaluationMode,
        maxPoints: maxPts,
        answerData: merged,
        instructorInitiated: true,
        attemptId: row.attempt_id,
        questionId: row.question_id,
        studentDatabaseId: row.student_id,
      },
    )

    reGraded = true
    const maxPoints = maxPts
    const rawPoints = graded.pointsEarned
    pointsEarned = graded.aiFeedback
      ? resolveAwardedPointsForAiSubmission({
          questionMaxPoints: maxPoints,
          questionType: "circuit_submission",
          tentativePoints: rawPoints,
          aiFeedback: graded.aiFeedback as Record<string, unknown>,
          aiEvaluationMode: evaluationMode,
          rawAnswer: compactJson,
        })
      : rawPoints
    isCorrect = graded.result.isCorrect ?? false
    requiresReview = graded.requiresReview
    aiFeedbackJson = graded.aiFeedback ? JSON.stringify(graded.aiFeedback) : null
    evaluationFeedback = graded.result.feedback || null

    const circuitAnswerDataPatch = {
      ...(typeof row.answer_data === "string"
        ? (() => {
            try {
              return JSON.parse(row.answer_data) as Record<string, unknown>
            } catch {
              return {}
            }
          })()
        : ((row.answer_data as Record<string, unknown>) ?? {})),
      ...graded.mergedAnswer,
      questionType: "circuit_submission",
      autoSave: false,
      evaluatedAt: new Date().toISOString(),
    }

    await sql`
      UPDATE quiz_answers
      SET
        selected_answer = ${JSON.stringify(graded.mergedAnswer)},
        answer_data = ${JSON.stringify(circuitAnswerDataPatch)}::jsonb,
        is_correct = ${isCorrect},
        points_earned = ${pointsEarned ?? 0},
        override_points = NULL,
        ai_feedback = ${aiFeedbackJson},
        requires_review = ${requiresReview},
        reviewed_by = ${requiresReview ? null : (options.instructorId ?? "instructor")},
        reviewed_at = ${requiresReview ? null : new Date()},
        feedback = ${evaluationFeedback}
      WHERE id = ${row.answer_id}
    `
  } else {
    let existingAd: Record<string, unknown> = {}
    if (row.answer_data) {
      try {
        existingAd =
          typeof row.answer_data === "string"
            ? (JSON.parse(row.answer_data) as Record<string, unknown>)
            : (row.answer_data as Record<string, unknown>)
      } catch {
        existingAd = {}
      }
    }

    await sql`
      UPDATE quiz_answers
      SET
        selected_answer = ${compactJson},
        answer_data = ${JSON.stringify({ ...existingAd, ...merged })}::jsonb
      WHERE id = ${row.answer_id}
    `
  }

  const attemptScore = await sql`
    SELECT SUM(points_earned) AS total_score
    FROM quiz_answers
    WHERE attempt_id = ${row.attempt_id}
  `
  const totalScore = Number(attemptScore[0]?.total_score) || 0
  const prevAttemptScore = await sql`
    SELECT score FROM quiz_attempts WHERE id = ${row.attempt_id}
  `
  const previousScore = Number(prevAttemptScore[0]?.score ?? 0)

  await sql`
    UPDATE quiz_attempts SET score = ${totalScore} WHERE id = ${row.attempt_id}
  `

  if (reGraded) {
    await recordAttemptScoreChange({
      attemptId: row.attempt_id,
      previousScore,
      newScore: totalScore,
      source: "instructor_workspace_export",
      actorType: "instructor",
      actorId: options.instructorId ?? "instructor",
      actorLabel: "Instructor exported workspace submission",
      reason: "Workspace PNG export and re-grade",
      metadata: { answerId: row.answer_id, questionId: row.question_id },
    })
    await tryAutoFinalizePerfectScore(row.attempt_id)
  }

  return {
    answerId: row.answer_id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    exportedPages: Object.keys(uploads).length,
    reGraded,
    pointsEarned,
    message: reGraded
      ? `Exported ${Object.keys(uploads).length} page(s) and re-graded (${pointsEarned ?? 0} pts).`
      : `Exported ${Object.keys(uploads).length} page(s).`,
  }
}

export async function exportWorkspaceSubmissionsForAttempt(options: {
  attemptId: number
  reGrade?: boolean
  instructorId?: string
}): Promise<{
  processed: ExportWorkspaceSubmissionResult[]
  skipped: number
  failed: Array<{ answerId: number; error: string }>
}> {
  const rows = await sql`
    SELECT
      qa.id AS answer_id,
      qa.selected_answer,
      qa.answer_data,
      qa.ai_feedback,
      qq.question_type
    FROM quiz_answers qa
    JOIN quiz_questions qq ON qq.id = qa.question_id
    WHERE qa.attempt_id = ${options.attemptId}
      AND qq.question_type = 'circuit_submission'
    ORDER BY qq.question_order ASC NULLS LAST, qa.id ASC
  `

  const processed: ExportWorkspaceSubmissionResult[] = []
  const failed: Array<{ answerId: number; error: string }> = []
  let skipped = 0

  for (const row of rows as Array<{
    answer_id: number
    selected_answer: string | null
    answer_data: unknown
    ai_feedback: unknown
    question_type: string
  }>) {
    const needs = circuitSubmissionNeedsWorkspaceExport(
      row.selected_answer,
      row.answer_data,
      row.ai_feedback,
    )
    if (!needs) {
      skipped++
      continue
    }
    try {
      const result = await exportWorkspaceSubmissionForAnswer({
        answerId: row.answer_id,
        reGrade: options.reGrade,
        instructorId: options.instructorId,
      })
      processed.push(result)
    } catch (e) {
      failed.push({
        answerId: row.answer_id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { processed, skipped, failed }
}
