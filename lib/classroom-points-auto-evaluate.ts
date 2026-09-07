import { sql } from "@/lib/db"
import { validateCodeWithAI } from "@/app/api/classroom-points/validate-code/route"
import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import type { ClassroomSolutionQuestionConfig } from "@/lib/classroom-solution-submission"
import {
  getRewardsPolicyForStudent,
  getStudentApprovedPointsToday,
} from "@/lib/rewards-policy.server"
import {
  ensureClassroomPointsAiFeedbackColumn,
  upsertReasonWithAiFeedback,
} from "@/lib/classroom-points-ai-feedback"
import {
  ensureClassroomPointsSchema,
} from "@/lib/ensure-classroom-points-schema"
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


export type ClassroomAutoEvaluateResult = {
  status: "approved" | "pending" | "rejected"
  pointsAwarded: number
  pointBooster: number
  aiGraded: boolean
  autoApproved: boolean
  instructorFeedback: string
  aiFeedback?: Record<string, unknown>
  requiresManualReview: boolean
}


async function canAutoApprovePoints(
  studentDbId: number,
  policy: Awaited<ReturnType<typeof getRewardsPolicyForStudent>>,
  pointsToAward: number,
): Promise<{ ok: boolean; reason?: string }> {
  if (!policy.auto_approve_submissions) {
    return { ok: false, reason: "Auto-approve is off — awaiting instructor review." }
  }
  if (pointsToAward <= 0) {
    return { ok: false, reason: "Score did not meet the threshold for automatic approval." }
  }
  const today = await getStudentApprovedPointsToday(studentDbId)
  if (today + pointsToAward > policy.max_daily_submission_points) {
    return {
      ok: false,
      reason: `Daily submission cap (${policy.max_daily_submission_points} pts) reached — instructor will review.`,
    }
  }
  return { ok: true }
}

export async function autoEvaluateClassroomCodeSubmission(opts: {
  classroomPointId: number
  studentDbId: number
  timingBooster: number
  baseReason: string
  code: string
  assignmentTitle: string
  assignmentDescription: string | null
  plotImage?: string | null
  expectedAnswer?: string | null
  /** When re-evaluating, never lower points below this value. */
  previousPoints?: number
}): Promise<ClassroomAutoEvaluateResult> {
  const {
    classroomPointId,
    studentDbId,
    timingBooster,
    baseReason,
    code,
    assignmentTitle,
    assignmentDescription,
    plotImage,
    expectedAnswer,
    previousPoints,
  } = opts

  await ensureClassroomPointsSchema()
  const policy = await getRewardsPolicyForStudent(studentDbId)
  const ai = await validateCodeWithAI(
    code,
    assignmentTitle,
    assignmentDescription || assignmentTitle,
    plotImage,
    expectedAnswer,
  )

  const hasWork = classroomCodeHasSubmittableWork(code)
  const advisoryScore = classroomScorePercentFromCodeValidation(ai.matches, Number(ai.points) || 0)
  const { scorePercent, pointsAwarded: computedPoints } = resolveClassroomPointsFromSubmission({
    hasWork,
    timingBooster,
  })
  const pointsAwarded =
    previousPoints != null
      ? mergeClassroomPointsPreservingGains(previousPoints, computedPoints)
      : computedPoints
  const instructorFeedback = String(ai.remark || "AI evaluation complete.")
  const requiresManualReview = !hasWork

  const approveCheck = await canAutoApprovePoints(studentDbId, policy, pointsAwarded)
  const autoApproved = approveCheck.ok && hasWork && !requiresManualReview
  const status: ClassroomAutoEvaluateResult["status"] = autoApproved
    ? "approved"
    : hasWork
      ? "pending"
      : "pending"

  const aiFeedbackPayload = buildClassroomAiFeedbackPayload({
    instructorFeedback,
    expectedAnswerReference: expectedAnswer,
    scorePercent,
    pointsAwarded,
    advisoryAiScore: advisoryScore,
    requiresManualReview: !autoApproved,
    extra: {
      matches: ai.matches,
      confidence: ai.confidence,
    },
  })

  const reason = upsertReasonWithAiFeedback(
    baseReason,
    autoApproved
      ? String(aiFeedbackPayload.feedback ?? instructorFeedback)
      : approveCheck.reason || String(aiFeedbackPayload.feedback ?? instructorFeedback),
  )

  await ensureClassroomPointsAiFeedbackColumn()

  if (autoApproved) {
    await sql`
      UPDATE classroom_points
      SET
        points = ${pointsAwarded},
        status = 'approved',
        awarded_at = NOW(),
        reason = ${reason},
        ai_feedback = ${JSON.stringify(aiFeedbackPayload)}::jsonb
      WHERE id = ${classroomPointId}
    `
    try {
      await sql`
        UPDATE codebench_submissions
        SET status = 'approved'
        WHERE classroom_point_id = ${classroomPointId}
      `
    } catch {
      /* optional link */
    }
  } else {
    await sql`
      UPDATE classroom_points
      SET
        points = ${pointsAwarded},
        reason = ${reason},
        ai_feedback = ${JSON.stringify(aiFeedbackPayload)}::jsonb
      WHERE id = ${classroomPointId}
    `
  }

  return {
    status,
    pointsAwarded,
    pointBooster: timingBooster,
    aiGraded: true,
    autoApproved,
    instructorFeedback: String(aiFeedbackPayload.feedback ?? instructorFeedback),
    requiresManualReview: !autoApproved,
    aiFeedback: aiFeedbackPayload,
  }
}

export async function autoEvaluateClassroomSolutionSubmission(opts: {
  classroomPointId: number
  studentDbId: number
  timingBooster: number
  baseReason: string
  studentAnswer: unknown
  questionConfig: ClassroomSolutionQuestionConfig
  previousPoints?: number
}): Promise<ClassroomAutoEvaluateResult> {
  const { classroomPointId, studentDbId, timingBooster, baseReason, studentAnswer, questionConfig, previousPoints } =
    opts

  await ensureClassroomPointsSchema()
  const policy = await getRewardsPolicyForStudent(studentDbId)

  const hasWork = classroomSolutionHasSubmittableWork(studentAnswer)

  const grade = await gradeCircuitSubmissionAnswer(
    {
      question_text: questionConfig.question_text,
      question_media: questionConfig.question_media,
      solution_upload_config: questionConfig.solution_upload_config,
      expected_answer: questionConfig.expected_answer,
      title: baseReason,
    },
    studentAnswer,
    { aiEvaluationMode: "relaxed", instructorInitiated: false },
  )

  const advisoryScore = classroomScorePercentFromCircuitGrade(
    grade,
    questionConfig.expected_answer,
  )
  const { scorePercent, pointsAwarded: computedPoints } = resolveClassroomPointsFromSubmission({
    hasWork,
    timingBooster,
  })
  const pointsAwarded =
    previousPoints != null
      ? mergeClassroomPointsPreservingGains(previousPoints, computedPoints)
      : computedPoints
  const rawInstructorFeedback =
    grade.result.feedback ||
    (grade.aiFeedback?.feedback as string) ||
    (grade.aiFeedback?.solutionFeedback as string) ||
    "AI evaluation complete."

  const requiresManualReview = !hasWork
  const approveCheck = await canAutoApprovePoints(studentDbId, policy, pointsAwarded)
  const autoApproved = approveCheck.ok && hasWork && !requiresManualReview

  const aiFeedbackPayload = buildClassroomAiFeedbackPayload({
    instructorFeedback: rawInstructorFeedback,
    expectedAnswerReference: questionConfig.expected_answer,
    scorePercent,
    pointsAwarded,
    advisoryAiScore: advisoryScore,
    requiresManualReview: !autoApproved,
    extra: {
      circuitSubmissionAiGraded: true,
      ...(grade.aiFeedback ?? {}),
    },
  })
  aiFeedbackPayload.solutionFeedback = aiFeedbackPayload.feedback
  const instructorFeedback = String(aiFeedbackPayload.feedback ?? rawInstructorFeedback)

  const reason = upsertReasonWithAiFeedback(
    baseReason,
    autoApproved ? instructorFeedback : approveCheck.reason || instructorFeedback,
  )

  await ensureClassroomPointsAiFeedbackColumn()

  if (autoApproved) {
    await sql`
      UPDATE classroom_points
      SET
        points = ${pointsAwarded},
        status = 'approved',
        awarded_at = NOW(),
        reason = ${reason},
        ai_feedback = ${JSON.stringify(aiFeedbackPayload)}::jsonb
      WHERE id = ${classroomPointId}
    `
  } else {
    await sql`
      UPDATE classroom_points
      SET
        points = ${pointsAwarded},
        reason = ${reason},
        ai_feedback = ${JSON.stringify(aiFeedbackPayload)}::jsonb
      WHERE id = ${classroomPointId}
    `
  }

  try {
    await sql`
      UPDATE classroom_solution_submissions
      SET answer_json = ${JSON.stringify(grade.mergedAnswer)}::jsonb
      WHERE classroom_point_id = ${classroomPointId}
    `
  } catch {
    /* optional */
  }

  return {
    status: autoApproved ? "approved" : "pending",
    pointsAwarded,
    pointBooster: timingBooster,
    aiGraded: true,
    autoApproved,
    instructorFeedback,
    requiresManualReview: !autoApproved,
    aiFeedback: aiFeedbackPayload,
  }
}
