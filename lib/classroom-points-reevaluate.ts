import { sql } from "@/lib/db"
import { validateCodeWithAI } from "@/app/api/classroom-points/validate-code/route"
import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import {
  CLASSROOM_SOLUTION_POINTS_CATEGORY,
  isClassroomSolutionAssignment,
  parseClassroomSolutionQuestionConfig,
} from "@/lib/classroom-solution-submission"
import {
  autoEvaluateClassroomCodeSubmission,
  autoEvaluateClassroomSolutionSubmission,
} from "@/lib/classroom-points-auto-evaluate"
import {
  resolveClassroomSubmissionBooster,
} from "@/lib/classroom-point-booster"
import {
  classroomScorePercentFromCircuitGrade,
  classroomScorePercentFromCodeValidation,
} from "@/lib/classroom-score-percent"
import {
  buildClassroomAiFeedbackPayload,
  classroomCodeHasSubmittableWork,
  classroomSolutionHasSubmittableWork,
  mergeClassroomPointsPreservingGains,
  resolveClassroomPointsFromSubmission,
} from "@/lib/classroom-points-grading-policy"
import { ensureClassroomPointsSchema } from "@/lib/ensure-classroom-points-schema"
import {
  classroomPointHasAiFeedback,
  ensureClassroomPointsAiFeedbackColumn,
  saveClassroomPointAiFeedback,
  stripAiSuffixFromReason,
  upsertReasonWithAiFeedback,
} from "@/lib/classroom-points-ai-feedback"

const BASE_POINTS = 2.5

export type ClassroomReevaluateResult = {
  classroomPointId: number
  studentDbId: number
  category: string
  status: "evaluated" | "skipped" | "error"
  message?: string
  aiGraded?: boolean
  autoApproved?: boolean
  instructorFeedback?: string
}

export type BulkReevaluateOptions = {
  session?: string | null
  courseId?: number | null
  status?: "pending" | "approved" | "all"
  skipWithFeedback?: boolean
  /** When true, approved rows keep their current points and status (feedback only). */
  preserveApprovedPoints?: boolean
  /** When true, always recalculate points from fresh AI (fixes under/over grading). */
  fullRecalculate?: boolean
  limit?: number
  dryRun?: boolean
}

type ClassroomPointRow = {
  id: number
  student_id: number
  category: string
  status: string | null
  reason: string | null
  submission_id: number | null
  point_booster: number | null
  points: number | string | null
  ai_feedback: unknown
  code: string | null
  plot_image: string | null
  answer_json: unknown
  assignment_title: string | null
  assignment_description: string | null
  submission_kind: string | null
  question_config: unknown
  created_at: string | Date
  opened_at?: string | Date | null
  deadline: string | Date | null
}

export async function listClassroomPointsForReevaluation(
  opts: BulkReevaluateOptions,
): Promise<ClassroomPointRow[]> {
  await ensureClassroomPointsAiFeedbackColumn()

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const session = opts.session && opts.session !== "ALL" ? opts.session : null
  const status = opts.status ?? "all"
  const pendingOnly = status === "pending"
  const approvedOnly = status === "approved"
  const courseId = opts.courseId ?? null

  const rows = await sql`
    SELECT
      cp.id, cp.student_id, cp.category, cp.status, cp.reason, cp.submission_id,
      cp.point_booster, cp.points, cp.ai_feedback, cp.created_at,
      cs.code, cs.plot_image, css.answer_json,
      cps.title as assignment_title, cps.description as assignment_description,
      COALESCE(cps.submission_kind, 'code') as submission_kind, cps.question_config,
      cps.created_at as opened_at,
      COALESCE(cps.due_at, cps.created_at + ((COALESCE(cps.duration_hours, 168)) * INTERVAL '1 hour')) as deadline
    FROM classroom_points cp
    INNER JOIN students s ON s.id = cp.student_id
    LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
    LEFT JOIN classroom_solution_submissions css ON css.classroom_point_id = cp.id
    LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
    WHERE cp.category IN ('code_submission', 'solution_submission')
      AND (${pendingOnly} = false OR cp.status = 'pending')
      AND (${approvedOnly} = false OR cp.status = 'approved' OR cp.status IS NULL)
      AND (${session}::text IS NULL OR cp.session = ${session} OR (cp.session IS NULL AND s.section = ${session}))
      AND (${courseId}::int IS NULL OR s.course_id = ${courseId})
    ORDER BY cp.created_at ASC
    LIMIT ${limit}
  `

  return rows as ClassroomPointRow[]
}

export async function reevaluateClassroomPoint(
  row: ClassroomPointRow,
  opts: Pick<BulkReevaluateOptions, "skipWithFeedback" | "preserveApprovedPoints" | "dryRun"> = {},
): Promise<ClassroomReevaluateResult> {
  const base: ClassroomReevaluateResult = {
    classroomPointId: row.id,
    studentDbId: row.student_id,
    category: row.category,
    status: "skipped",
  }

  if (opts.skipWithFeedback !== false && classroomPointHasAiFeedback(row)) {
    return { ...base, message: "Already has AI feedback" }
  }

  const timingBooster = resolveClassroomSubmissionBooster({
    submissionId: row.submission_id,
    openedAt: row.opened_at,
    deadline: row.deadline,
    submittedAt: row.created_at,
  })
  const baseReason =
    stripAiSuffixFromReason(row.reason) ||
    row.assignment_title?.trim() ||
    (row.category === CLASSROOM_SOLUTION_POINTS_CATEGORY ? "Solution submission" : "Code submission")

  const isApproved = row.status === "approved" || row.status == null
  const fullRecalculate = opts.fullRecalculate === true
  const preservePoints = !fullRecalculate && opts.preserveApprovedPoints !== false && isApproved

  if (opts.dryRun) {
    return { ...base, status: "evaluated", message: "Dry run — would evaluate" }
  }

  try {
    if (row.category === "code_submission") {
      const code = row.code?.trim()
      if (!code) {
        return { ...base, message: "No code found for this submission" }
      }

      if (preservePoints) {
        const expectedAnswer =
          parseClassroomSolutionQuestionConfig(row.question_config)?.expected_answer ?? null
        const ai = await validateCodeWithAI(
          code,
          row.assignment_title || baseReason,
          row.assignment_description || row.assignment_title || baseReason,
          row.plot_image,
          expectedAnswer,
        )
        const rawFeedback = String(ai.remark || "AI evaluation complete.")
        const hasWork = classroomCodeHasSubmittableWork(code)
        const advisoryScore = classroomScorePercentFromCodeValidation(ai.matches, Number(ai.points) || 0)
        const { scorePercent, pointsAwarded: computedPoints } = resolveClassroomPointsFromSubmission({
          hasWork,
          timingBooster,
        })
        const pointsEarned = mergeClassroomPointsPreservingGains(Number(row.points || 0), computedPoints)
        const aiFeedback = buildClassroomAiFeedbackPayload({
          instructorFeedback: rawFeedback,
          expectedAnswerReference: expectedAnswer,
          scorePercent,
          pointsAwarded: pointsEarned,
          advisoryAiScore: advisoryScore,
          extra: {
            matches: ai.matches,
            confidence: ai.confidence,
            backfill: true,
          },
        })
        const instructorFeedback = String(aiFeedback.feedback ?? rawFeedback)
        const reason = upsertReasonWithAiFeedback(baseReason, instructorFeedback)
        await saveClassroomPointAiFeedback({
          classroomPointId: row.id,
          reason,
          aiFeedback,
        })
        if (pointsEarned > Number(row.points || 0) || timingBooster !== Math.max(1, Number(row.point_booster) || 1)) {
          await sql`
            UPDATE classroom_points
            SET points = ${pointsEarned}, point_booster = ${timingBooster}
            WHERE id = ${row.id}
          `
        }
        return {
          ...base,
          status: "evaluated",
          aiGraded: true,
          instructorFeedback,
        }
      }

      const result = await autoEvaluateClassroomCodeSubmission({
        classroomPointId: row.id,
        studentDbId: row.student_id,
        timingBooster,
        baseReason,
        code,
        assignmentTitle: row.assignment_title || baseReason,
        assignmentDescription: row.assignment_description ?? null,
        plotImage: row.plot_image,
        expectedAnswer: parseClassroomSolutionQuestionConfig(row.question_config)?.expected_answer ?? null,
        previousPoints: Number(row.points || 0),
      })
      return {
        ...base,
        status: "evaluated",
        aiGraded: result.aiGraded,
        autoApproved: result.autoApproved,
        instructorFeedback: result.instructorFeedback,
      }
    }

    if (row.category === CLASSROOM_SOLUTION_POINTS_CATEGORY) {
      if (!row.answer_json) {
        return { ...base, message: "No solution upload found for this submission" }
      }
      const questionConfig = parseClassroomSolutionQuestionConfig(row.question_config)
      if (!questionConfig) {
        return { ...base, message: "Assignment missing question_config for AI grading" }
      }

      let studentAnswer: unknown = row.answer_json
      if (typeof studentAnswer === "string") {
        try {
          studentAnswer = JSON.parse(studentAnswer)
        } catch {
          /* keep string */
        }
      }

      if (preservePoints) {
        const grade = await gradeCircuitSubmissionAnswer(
          {
            question_text: questionConfig.question_text,
            question_media: questionConfig.question_media,
            solution_upload_config: questionConfig.solution_upload_config,
            expected_answer: questionConfig.expected_answer,
            title: baseReason,
          },
          studentAnswer,
          { aiEvaluationMode: "relaxed", instructorInitiated: fullRecalculate },
        )
        const rawFeedback =
          grade.result.feedback ||
          (grade.aiFeedback?.feedback as string) ||
          (grade.aiFeedback?.solutionFeedback as string) ||
          "AI evaluation complete."
        const hasWork = classroomSolutionHasSubmittableWork(studentAnswer)
        const advisoryScore = classroomScorePercentFromCircuitGrade(
          grade,
          questionConfig.expected_answer,
        )
        const { scorePercent, pointsAwarded: computedPoints } = resolveClassroomPointsFromSubmission({
          hasWork,
          timingBooster,
        })
        const pointsEarned = mergeClassroomPointsPreservingGains(Number(row.points || 0), computedPoints)
        const aiFeedback = buildClassroomAiFeedbackPayload({
          instructorFeedback: rawFeedback,
          expectedAnswerReference: questionConfig.expected_answer,
          scorePercent,
          pointsAwarded: pointsEarned,
          advisoryAiScore: advisoryScore,
          extra: {
            circuitSubmissionAiGraded: true,
            backfill: true,
            ...(grade.aiFeedback ?? {}),
          },
        })
        aiFeedback.solutionFeedback = aiFeedback.feedback
        const instructorFeedback = String(aiFeedback.feedback ?? rawFeedback)
        const reason = upsertReasonWithAiFeedback(baseReason, instructorFeedback)
        await saveClassroomPointAiFeedback({
          classroomPointId: row.id,
          reason,
          aiFeedback,
        })
        if (pointsEarned > Number(row.points || 0) || timingBooster !== Math.max(1, Number(row.point_booster) || 1)) {
          await sql`
            UPDATE classroom_points
            SET points = ${pointsEarned}, point_booster = ${timingBooster}
            WHERE id = ${row.id}
          `
        }
        try {
          await sql`
            UPDATE classroom_solution_submissions
            SET answer_json = ${JSON.stringify(grade.mergedAnswer)}::jsonb
            WHERE classroom_point_id = ${row.id}
          `
        } catch {
          /* optional */
        }
        return {
          ...base,
          status: "evaluated",
          aiGraded: true,
          instructorFeedback,
        }
      }

      const result = await autoEvaluateClassroomSolutionSubmission({
        classroomPointId: row.id,
        studentDbId: row.student_id,
        timingBooster,
        baseReason,
        studentAnswer,
        questionConfig,
        previousPoints: Number(row.points || 0),
      })
      return {
        ...base,
        status: "evaluated",
        aiGraded: result.aiGraded,
        autoApproved: result.autoApproved,
        instructorFeedback: result.instructorFeedback,
      }
    }

    if (isClassroomSolutionAssignment(row.submission_kind) && row.category !== CLASSROOM_SOLUTION_POINTS_CATEGORY) {
      return { ...base, message: "Legacy category mismatch — skipped" }
    }

    return { ...base, message: `Unsupported category: ${row.category}` }
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: error instanceof Error ? error.message : "Evaluation failed",
    }
  }
}

export async function bulkReevaluateClassroomPoints(
  opts: BulkReevaluateOptions,
): Promise<{
  processed: ClassroomReevaluateResult[]
  summary: { evaluated: number; skipped: number; errors: number }
}> {
  await ensureClassroomPointsSchema()
  const rows = await listClassroomPointsForReevaluation(opts)
  const processed: ClassroomReevaluateResult[] = []

  for (const row of rows) {
    const result = await reevaluateClassroomPoint(row, opts)
    processed.push(result)
  }

  return {
    processed,
    summary: {
      evaluated: processed.filter((r) => r.status === "evaluated").length,
      skipped: processed.filter((r) => r.status === "skipped").length,
      errors: processed.filter((r) => r.status === "error").length,
    },
  }
}
