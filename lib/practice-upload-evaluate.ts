import { gradeCircuitSubmissionAnswer } from "@/lib/grade-circuit-submission-answer"
import { gradeMultiPartAnswer } from "@/lib/grade-multi-part-answer"
import { usesStandardMultiPartGradingPolicy } from "@/lib/multi-part-grading-policy"
import { formatEvaluateApiResponse } from "@/lib/assessment-core/format-evaluate-api-response"
import { getRewardsPolicyForStudent } from "@/lib/rewards-policy.server"
import { savePracticeAnswerRecord } from "@/lib/save-practice-answer"

export async function evaluatePracticeUploadQuestion(opts: {
  questionType: string
  question: Record<string, unknown>
  answer: unknown
  attemptId?: number | null
  questionId: number
  responseTimeMs?: number | null
  xpEarned?: number | null
  difficulty?: string | null
  studentDbId?: number | null
}): Promise<Record<string, unknown>> {
  const {
    questionType,
    question,
    answer,
    attemptId,
    questionId,
    responseTimeMs,
    xpEarned,
    difficulty,
    studentDbId,
  } = opts

  const qt = questionType.toLowerCase()
  const maxPoints = 1

  if (qt === "circuit_submission") {
    const grade = await gradeCircuitSubmissionAnswer(
      {
        question_text: String(question.question_text ?? ""),
        question_media: question.question_media,
        solution_upload_config: question.solution_upload_config,
        expected_answer: question.expected_answer as string | null,
        hint: question.hint as string | null,
      },
      answer,
      { aiEvaluationMode: "standard" },
    )

    const scorePercent = Number(grade.result.points ?? 0)
    const isCorrect = scorePercent >= 50 && !grade.requiresReview
    const pointsEarned = Number.parseFloat(((scorePercent / 100) * maxPoints).toFixed(2))

    if (attemptId) {
      await savePracticeAnswerRecord({
        attemptId,
        questionId,
        answer: grade.mergedAnswer,
        isCorrect,
        responseTimeMs: responseTimeMs ?? null,
        xpEarned: isCorrect ? (xpEarned ?? 0) : 0,
        difficulty: difficulty ?? null,
      })
    }

    const payload = formatEvaluateApiResponse({
      result: {
        isCorrect,
        points: scorePercent,
        pointsEarned,
        feedback: grade.result.feedback,
        requiresReview: grade.requiresReview,
      },
      aiFeedback: grade.aiFeedback,
      questionType: qt,
      maxPoints,
    })

    return applyPracticeAutoApprovePolicy(payload, studentDbId, grade.requiresReview, isCorrect)
  }

  if (qt === "multi_part") {
    if (!usesStandardMultiPartGradingPolicy(question.solution_upload_config, qt)) {
      return { error: "Multi-part policy not configured for AI grading" }
    }

    const grade = await gradeMultiPartAnswer(
      {
        subquestions: question.subquestions,
        solution_upload_config: question.solution_upload_config,
        question_text: String(question.question_text ?? ""),
        question_media: question.question_media,
        circuit_spec: question.circuit_spec,
        sample_answer: question.sample_answer as string | null,
        answer_guidelines: question.answer_guidelines as string | null,
      },
      answer,
      { aiEvaluationMode: "standard", questionMaxPoints: maxPoints },
    )

    if (!grade) {
      return { isCorrect: false, feedback: "Could not grade multi-part answer.", aiGraded: false }
    }

    const scorePercent = Number(grade.result.points ?? 0)
    const isCorrect = scorePercent >= 50 && !grade.requiresReview

    if (attemptId) {
      await savePracticeAnswerRecord({
        attemptId,
        questionId,
        answer,
        isCorrect,
        responseTimeMs: responseTimeMs ?? null,
        xpEarned: isCorrect ? (xpEarned ?? 0) : 0,
        difficulty: difficulty ?? null,
      })
    }

    const payload = formatEvaluateApiResponse({
      result: {
        isCorrect,
        points: scorePercent,
        pointsEarned: grade.pointsEarned,
        feedback: grade.result.feedback,
        requiresReview: grade.requiresReview,
      },
      aiFeedback: grade.aiFeedback,
      questionType: qt,
      maxPoints: grade.maxPointsForQuestion,
    })

    return applyPracticeAutoApprovePolicy(payload, studentDbId, grade.requiresReview, isCorrect)
  }

  return { error: `Unsupported practice upload type: ${qt}` }
}

async function applyPracticeAutoApprovePolicy(
  payload: Record<string, unknown>,
  studentDbId: number | null | undefined,
  requiresReview: boolean,
  isCorrect: boolean,
): Promise<Record<string, unknown>> {
  if (studentDbId == null) return payload

  const policy = await getRewardsPolicyForStudent(studentDbId)
  const autoApprove = policy.auto_approve_practice_submissions

  return {
    ...payload,
    autoApproved: autoApprove && isCorrect && !requiresReview,
    practicePolicyAutoApprove: autoApprove,
    requiresManualReview: autoApprove ? requiresReview && !isCorrect : requiresReview || !isCorrect,
  }
}
