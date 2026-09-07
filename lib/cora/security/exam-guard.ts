/**
 * High-stakes / active assessment guards.
 * Prefer resolveAssessmentIntegrityContext for nuanced capability decisions.
 * Do NOT treat "student + quiz = Cora disabled".
 */

import {
  resolveAssessmentIntegrityContext,
  shouldRefuseAssessmentAnswers,
  looksLikeAnswerSeekingRequest,
  buildAssessmentIntegrityRefusal,
  type AssessmentIntegrityContext,
} from "@/lib/cora/security/assessment-integrity"

export type ActiveExamBlock = {
  blocked: boolean
  assessmentTitle?: string
  assessmentType?: string
  reason?: string
  integrity?: AssessmentIntegrityContext | null
}

/**
 * Block answer-giving while the student has an unfinished midterm/final attempt.
 * Non–high-stakes active quizzes stay available with restricted capabilities.
 */
export async function detectActiveHighStakesExam(studentDbId: number): Promise<ActiveExamBlock> {
  if (!Number.isFinite(studentDbId) || studentDbId <= 0) return { blocked: false }

  const integrity = await resolveAssessmentIntegrityContext(studentDbId)
  if (integrity.state !== "active") {
    return { blocked: false, integrity }
  }

  if (!integrity.highStakes) {
    return {
      blocked: false,
      integrity,
      assessmentTitle: integrity.title ?? undefined,
      assessmentType: integrity.assessmentType ?? undefined,
      reason: integrity.reason,
    }
  }

  return {
    blocked: true,
    assessmentTitle: integrity.title ?? undefined,
    assessmentType: integrity.assessmentType ?? undefined,
    reason: integrity.reason ?? buildAssessmentIntegrityRefusal(integrity),
    integrity,
  }
}

/** @deprecated prefer looksLikeAnswerSeekingRequest from assessment-integrity */
export function looksLikeExamAnswerRequest(message: string): boolean {
  return looksLikeAnswerSeekingRequest(message)
}

export const ACTIVE_EXAM_REFUSAL =
  "I can't provide answers while you have an active midterm or final in progress. Submit the assessment first — then I can help you review and study."

/** Prefer this over crude disable: refuse answer-seeking under restricted integrity. */
export async function refuseIfIntegrityBlocksAnswers(
  studentDbId: number,
  message: string,
): Promise<{ refuse: boolean; message?: string; context: AssessmentIntegrityContext }> {
  return shouldRefuseAssessmentAnswers(studentDbId, message)
}
