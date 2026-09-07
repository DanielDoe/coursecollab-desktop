/**
 * Load authoritative assessment / attempt state, then evaluate CoraAssessmentPolicy.
 * Never trust client-claimed release or eligibility flags.
 */

import { sql } from "@/lib/db"
import {
  CoraAssessmentPolicy,
  defaultInstructorCoraPolicy,
  type CoraAssessmentPolicyResult,
  type InstructorCoraPolicy,
} from "@/lib/cora/assessment-policy"
import type { CoraProblemContext } from "@/lib/cora/types"

export type ResolveAskCoraPolicyInput = {
  studentId: number
  message?: string | null
  source?: string | null
  quizId?: number | null
  questionId?: number | null
  bankQuestionId?: number | null
  attemptId?: number | null
  questionType?: string | null
  lectureId?: number | null
  subquestionTypes?: Array<string | null | undefined>
}

export type ResolvedAskCoraPolicy = {
  policy: CoraAssessmentPolicyResult
  courseId: number | null
  assessmentId: number | null
  assessmentType: string | null
  questionId: number | null
  bankQuestionId: number | null
  attemptId: number | null
  questionType: string | null
  topic: string | null
  source: string
}

function parseInstructorPolicy(raw: unknown): InstructorCoraPolicy {
  const value = String(raw ?? "").toLowerCase().trim()
  if (value === "disabled" || value === "guided_only" || value === "open" || value === "review_after_release") {
    return value
  }
  return defaultInstructorCoraPolicy()
}

function isClosed(availableUntil: string | Date | null | undefined): boolean {
  if (!availableUntil) return false
  const due = new Date(availableUntil)
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now()
}

async function loadQuizState(studentId: number, quizId: number, attemptId?: number | null) {
  const quizRows = (await sql`
    SELECT
      q.id,
      q.course_id,
      q.title,
      q.assessment_type,
      q.available_until,
      q.retake_limit,
      q.retake_enabled
    FROM quizzes q
    WHERE q.id = ${quizId}
      AND q.deleted_at IS NULL
    LIMIT 1
  `) as Array<{
    id: number
    course_id: number | null
    title: string | null
    assessment_type: string | null
    available_until: string | null
    retake_limit: number | null
    retake_enabled: boolean | null
  }>

  const quiz = quizRows[0]
  if (!quiz) return null

  let policyRaw: unknown = null
  try {
    const policyRows = (await sql`
      SELECT cora_assistance_policy
      FROM quizzes
      WHERE id = ${quizId}
      LIMIT 1
    `) as Array<{ cora_assistance_policy?: string | null }>
    policyRaw = policyRows[0]?.cora_assistance_policy
  } catch {
    policyRaw = null
  }

  const attemptRows = (await sql`
    SELECT
      qa.id,
      qa.completed_at,
      qa.results_finalized_at,
      qa.score
    FROM quiz_attempts qa
    WHERE qa.student_id = ${studentId}
      AND qa.quiz_id = ${quizId}
      AND qa.deleted_at IS NULL
      AND (${attemptId ?? null}::int IS NULL OR qa.id = ${attemptId ?? null})
    ORDER BY qa.started_at DESC NULLS LAST
    LIMIT 1
  `) as Array<{
    id: number
    completed_at: string | null
    results_finalized_at: string | null
    score: number | null
  }>

  const attempt = attemptRows[0]
  const completedCountRows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM quiz_attempts
    WHERE student_id = ${studentId}
      AND quiz_id = ${quizId}
      AND deleted_at IS NULL
      AND completed_at IS NOT NULL
  `) as Array<{ n: number }>
  const completedCount = Number(completedCountRows[0]?.n ?? 0)
  const retakeLimit = quiz.retake_enabled ? Number(quiz.retake_limit ?? 0) : 0
  const maxAttempts = Math.max(1, retakeLimit + 1)
  const remaining = Math.max(0, maxAttempts - completedCount)
  const submitted = Boolean(attempt?.completed_at)
  const active = Boolean(attempt && !attempt.completed_at)

  return {
    courseId: quiz.course_id != null ? Number(quiz.course_id) : null,
    assessmentId: Number(quiz.id),
    assessmentType: quiz.assessment_type,
    attemptId: attempt ? Number(attempt.id) : attemptId ?? null,
    submitted,
    graded: attempt?.score != null || attempt?.results_finalized_at != null,
    assessmentActive: active,
    assessmentClosed: isClosed(quiz.available_until) || (submitted && remaining <= 0),
    attemptsRemaining: remaining,
    solutionsReleased: attempt?.results_finalized_at != null,
    instructorPolicy: parseInstructorPolicy(policyRaw),
  }
}

async function loadPracticeState(studentId: number, attemptId?: number | null) {
  if (attemptId == null || !Number.isFinite(attemptId)) return null
  const rows = (await sql`
    SELECT
      pa.id,
      pa.completed_at,
      s.course_id
    FROM practice_attempts pa
    JOIN students s ON s.id = pa.student_id
    WHERE pa.id = ${attemptId}
      AND pa.student_id = ${studentId}
    LIMIT 1
  `) as Array<{ id: number; completed_at: string | null; course_id: number | null }>
  const row = rows[0]
  if (!row) return null
  const submitted = Boolean(row.completed_at)
  return {
    courseId: row.course_id != null ? Number(row.course_id) : null,
    assessmentId: null,
    assessmentType: "practice",
    attemptId: Number(row.id),
    submitted,
    graded: submitted,
    assessmentActive: !submitted,
    assessmentClosed: submitted,
    attemptsRemaining: submitted ? 0 : 1,
    solutionsReleased: false,
    instructorPolicy: defaultInstructorCoraPolicy(),
  }
}

async function loadQuestionType(input: ResolveAskCoraPolicyInput): Promise<{
  questionType: string | null
  topic: string | null
  questionId: number | null
  bankQuestionId: number | null
  quizId: number | null
}> {
  if (input.questionId != null && Number.isFinite(Number(input.questionId)) && input.source !== "practice_hub") {
    const rows = (await sql`
      SELECT question_type, topic, id, bank_question_id, quiz_id
      FROM quiz_questions
      WHERE id = ${Number(input.questionId)}
      LIMIT 1
    `) as Array<{
      question_type: string | null
      topic: string | null
      id: number
      bank_question_id: number | null
      quiz_id: number | null
    }>
    if (rows[0]) {
      return {
        questionType: rows[0].question_type,
        topic: rows[0].topic,
        questionId: Number(rows[0].id),
        bankQuestionId: rows[0].bank_question_id != null ? Number(rows[0].bank_question_id) : null,
        quizId: rows[0].quiz_id != null ? Number(rows[0].quiz_id) : null,
      }
    }
  }

  const bankId = input.bankQuestionId ?? (input.source === "practice_hub" ? input.questionId : null)
  if (bankId != null && Number.isFinite(Number(bankId))) {
    const rows = (await sql`
      SELECT question_type, topic, id
      FROM question_bank
      WHERE id = ${Number(bankId)}
        AND deleted_at IS NULL
      LIMIT 1
    `) as Array<{ question_type: string | null; topic: string | null; id: number }>
    if (rows[0]) {
      return {
        questionType: rows[0].question_type,
        topic: rows[0].topic,
        questionId: Number(rows[0].id),
        bankQuestionId: Number(rows[0].id),
        quizId: null,
      }
    }
  }

  return {
    questionType: input.questionType ?? null,
    topic: null,
    questionId: input.questionId != null ? Number(input.questionId) : null,
    bankQuestionId: input.bankQuestionId != null ? Number(input.bankQuestionId) : null,
    quizId: input.quizId ?? null,
  }
}

export async function resolveAskCoraPolicy(
  input: ResolveAskCoraPolicyInput,
): Promise<ResolvedAskCoraPolicy> {
  const source = String(input.source ?? "custom").toLowerCase()
  const question = await loadQuestionType(input)
  const quizId = input.quizId ?? question.quizId

  let state = {
    courseId: null as number | null,
    assessmentId: quizId ?? null,
    assessmentType: null as string | null,
    attemptId: input.attemptId ?? null,
    submitted: false,
    graded: false,
    assessmentActive: false,
    assessmentClosed: false,
    attemptsRemaining: null as number | null,
    solutionsReleased: false,
    instructorPolicy: defaultInstructorCoraPolicy(),
  }

  if (quizId != null && Number.isFinite(Number(quizId))) {
    const quizState = await loadQuizState(input.studentId, Number(quizId), input.attemptId)
    if (quizState) state = { ...state, ...quizState }
  } else if (source === "practice_hub" || source === "practice") {
    const practiceState = await loadPracticeState(input.studentId, input.attemptId)
    if (practiceState) state = { ...state, ...practiceState }
    else {
      state.assessmentType = "practice"
      state.assessmentActive = true
    }
  } else if (source === "lecture_workspace" || source === "lecture_practice") {
    state.assessmentType = "lecture"
    state.assessmentActive = true
    state.instructorPolicy = "guided_only"
  } else if (question.questionType) {
    state.assessmentActive = true
  }

  const policy = CoraAssessmentPolicy.evaluate({
    studentId: input.studentId,
    courseId: state.courseId,
    assessmentType: state.assessmentType,
    questionType: question.questionType,
    subquestionTypes: input.subquestionTypes,
    source,
    submitted: state.submitted,
    graded: state.graded,
    questionAnswered: state.submitted,
    assessmentActive: state.assessmentActive,
    assessmentClosed: state.assessmentClosed,
    attemptsRemaining: state.attemptsRemaining,
    solutionsReleased: state.solutionsReleased,
    instructorPolicy: state.instructorPolicy,
    message: input.message,
  })

  return {
    policy,
    courseId: state.courseId,
    assessmentId: state.assessmentId,
    assessmentType: state.assessmentType,
    questionId: question.questionId,
    bankQuestionId: question.bankQuestionId,
    attemptId: state.attemptId,
    questionType: question.questionType,
    topic: question.topic,
    source,
  }
}

export function resolveInputFromProblem(
  studentId: number,
  message: string | null | undefined,
  problem: CoraProblemContext | null | undefined,
  extras?: { attemptId?: number | null },
): ResolveAskCoraPolicyInput {
  return {
    studentId,
    message,
    source: problem?.source ?? null,
    quizId: problem?.quizId ?? null,
    questionId: problem?.questionId != null ? Number(problem.questionId) : null,
    bankQuestionId: problem?.bankQuestionId ?? null,
    attemptId: extras?.attemptId ?? (problem as { attemptId?: number } | null)?.attemptId ?? null,
    questionType: problem?.questionType ?? null,
    lectureId: problem?.lectureId ?? null,
  }
}
